use serde::{Deserialize, Serialize};

use crate::domain::config::AppConfig;
use crate::error::{AppError, Result};
use super::{build_client, Message, retry_delay, retries_exhausted};

const MAX_RETRIES: u32 = 3;

#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Deserialize)]
struct OpenAIChoiceMessage {
    content: String,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    message: OpenAIChoiceMessage,
}

#[derive(Deserialize)]
struct OpenAIDeltaContent {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OpenAIStreamChoice {
    delta: OpenAIDeltaContent,
}

#[derive(Deserialize)]
struct OpenAIStreamChunk {
    choices: Vec<OpenAIStreamChoice>,
}

pub async fn generate(config: &AppConfig, prompt: &str) -> Result<String> {
    let client = build_client(config.timeout)?;
    let url = format!("{}/v1/chat/completions", config.api_base_url);

    for attempt in 0..MAX_RETRIES {
        let request = OpenAIRequest {
            model: config.active_model().to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            stream: false,
        };

        let resp = match client
            .post(&url)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .json(&request)
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) if attempt < MAX_RETRIES - 1 => {
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
            Err(e) => return Err(AppError::AiFailed(e.to_string())),
        };

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            if attempt < MAX_RETRIES - 1 && status.is_server_error() {
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
            return Err(AppError::AiFailed(format!(
                "API 返回错误 {}: {}",
                status, body
            )));
        }

        let body: OpenAIResponse = resp.json().await?;
        return body
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .ok_or_else(|| AppError::AiFailed("API 返回空响应".to_string()));
    }
    Err(retries_exhausted())
}

pub async fn generate_streaming<F>(config: &AppConfig, prompt: &str, on_chunk: F) -> Result<String>
where
    F: Fn(&str) -> Result<()>,
{
    let client = build_client(config.timeout * 2)?;
    let url = format!("{}/v1/chat/completions", config.api_base_url);

    for attempt in 0..MAX_RETRIES {
        let request = OpenAIRequest {
            model: config.active_model().to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            stream: true,
        };

        let resp = match client
            .post(&url)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .json(&request)
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) if attempt < MAX_RETRIES - 1 => {
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
            Err(e) => return Err(AppError::AiFailed(e.to_string())),
        };

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            if attempt < MAX_RETRIES - 1 && status.is_server_error() {
                on_chunk(&format!(
                    "\n\n[服务端错误，正在重试 ({}/{})...]\n\n",
                    attempt + 2,
                    MAX_RETRIES
                ))?;
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
            return Err(AppError::AiFailed(format!(
                "API 返回错误 {}: {}",
                status, body
            )));
        }

        let mut full_text = String::new();
        let mut buffer = String::new();

        match stream_response(resp, &mut buffer, &mut full_text, &on_chunk).await {
            Ok(()) => return Ok(full_text),
            Err(_) if attempt < MAX_RETRIES - 1 => {
                on_chunk(&format!(
                    "\n\n[连接中断，正在重试 ({}/{})...]\n\n",
                    attempt + 2,
                    MAX_RETRIES
                ))?;
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
            Err(e) => return Err(e),
        }
    }
    Err(retries_exhausted())
}

async fn stream_response<F>(
    resp: reqwest::Response,
    buffer: &mut String,
    full_text: &mut String,
    on_chunk: F,
) -> Result<()>
where
    F: Fn(&str) -> Result<()>,
{
    let mut resp = resp;
    while let Some(chunk) = resp.chunk().await? {
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            *buffer = buffer[pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if line == "data: [DONE]" {
                return Ok(());
            }

            let data = match line.strip_prefix("data: ") {
                Some(d) => d,
                None => continue,
            };

            let parsed: OpenAIStreamChunk = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(choice) = parsed.choices.into_iter().next() {
                if let Some(content) = choice.delta.content {
                    if !content.is_empty() {
                        on_chunk(&content)?;
                        full_text.push_str(&content);
                    }
                }
            }
        }
    }

    Ok(())
}
