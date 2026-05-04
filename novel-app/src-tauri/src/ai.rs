use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::config::{AppConfig, Provider};
use crate::error::{AppError, Result};

// ===== 共享类型 =====

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

// ===== Ollama 类型 =====

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct OllamaOptions {
    num_ctx: u32,
}

#[derive(Deserialize)]
struct OllamaResponse {
    message: OllamaMessageContent,
}

#[derive(Deserialize)]
struct OllamaMessageContent {
    content: String,
}

#[derive(Deserialize)]
struct OllamaStreamChunk {
    message: Option<OllamaStreamMessage>,
    done: bool,
    error: Option<String>,
}

#[derive(Deserialize)]
struct OllamaStreamMessage {
    content: String,
}

// ===== OpenAI 兼容类型 =====

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

// ===== 公开 API =====

pub async fn generate(config: &AppConfig, prompt: &str) -> Result<String> {
    match config.provider {
        Provider::Ollama => generate_ollama(config, prompt).await,
        Provider::OpenAI => generate_openai(config, prompt).await,
    }
}

pub async fn generate_streaming<F>(
    config: &AppConfig,
    prompt: &str,
    on_chunk: F,
) -> Result<String>
where
    F: Fn(&str) -> Result<()>,
{
    match config.provider {
        Provider::Ollama => generate_streaming_ollama(config, prompt, on_chunk).await,
        Provider::OpenAI => generate_streaming_openai(config, prompt, on_chunk).await,
    }
}

// ===== Ollama 实现 =====

async fn generate_ollama(config: &AppConfig, prompt: &str) -> Result<String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(config.timeout))
        .build()?;

    let url = format!("{}/api/chat", config.ollama_url);
    let max_retries = 3;

    for attempt in 0..max_retries {
        let request = OllamaRequest {
            model: config.active_model().to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            stream: false,
            options: OllamaOptions { num_ctx: 4096 },
        };

        match client.post(&url).json(&request).send().await {
            Ok(resp) => {
                let body: OllamaResponse = resp.json().await?;
                return Ok(body.message.content);
            }
            Err(_) if attempt < max_retries - 1 => {
                tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
            }
            Err(e) => {
                return Err(AppError::AiFailed(e.to_string()));
            }
        }
    }

    unreachable!()
}

async fn generate_streaming_ollama<F>(
    config: &AppConfig,
    prompt: &str,
    on_chunk: F,
) -> Result<String>
where
    F: Fn(&str) -> Result<()>,
{
    let client = Client::builder()
        .timeout(Duration::from_secs(config.timeout * 2))
        .build()?;

    let url = format!("{}/api/chat", config.ollama_url);
    let max_retries = 3;

    for attempt in 0..max_retries {
        let request = OllamaRequest {
            model: config.active_model().to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            stream: true,
            options: OllamaOptions { num_ctx: 4096 },
        };

        match client.post(&url).json(&request).send().await {
            Ok(resp) => {
                let mut full_text = String::new();
                let mut buffer = String::new();

                match stream_ollama_response(resp, &mut buffer, &mut full_text, &on_chunk).await {
                    Ok(()) => return Ok(full_text),
                    Err(_) if attempt < max_retries - 1 => {
                        on_chunk(&format!(
                            "\n\n[连接中断，正在重试 ({}/{})...]\n\n",
                            attempt + 2,
                            max_retries
                        ))?;
                        tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
                        continue;
                    }
                    Err(e) => return Err(e),
                }
            }
            Err(_) if attempt < max_retries - 1 => {
                tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
            }
            Err(e) => {
                return Err(AppError::AiFailed(e.to_string()));
            }
        }
    }

    unreachable!()
}

async fn stream_ollama_response<F>(
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

            let parsed: OllamaStreamChunk = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(err) = parsed.error {
                return Err(AppError::AiFailed(err));
            }

            if let Some(msg) = parsed.message {
                if !msg.content.is_empty() {
                    on_chunk(&msg.content)?;
                    full_text.push_str(&msg.content);
                }
            }

            if parsed.done {
                return Ok(());
            }
        }
    }

    Ok(())
}

// ===== OpenAI 兼容实现 =====

async fn generate_openai(config: &AppConfig, prompt: &str) -> Result<String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(config.timeout))
        .build()?;

    let url = format!("{}/v1/chat/completions", config.api_base_url);
    let max_retries = 3;

    for attempt in 0..max_retries {
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
            Err(_) if attempt < max_retries - 1 => {
                tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
                continue;
            }
            Err(e) => return Err(AppError::AiFailed(e.to_string())),
        };

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            if attempt < max_retries - 1 && status.is_server_error() {
                tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
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

    unreachable!()
}

async fn generate_streaming_openai<F>(
    config: &AppConfig,
    prompt: &str,
    on_chunk: F,
) -> Result<String>
where
    F: Fn(&str) -> Result<()>,
{
    let client = Client::builder()
        .timeout(Duration::from_secs(config.timeout * 2))
        .build()?;

    let url = format!("{}/v1/chat/completions", config.api_base_url);
    let max_retries = 3;

    for attempt in 0..max_retries {
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
            Err(_) if attempt < max_retries - 1 => {
                tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
                continue;
            }
            Err(e) => return Err(AppError::AiFailed(e.to_string())),
        };

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            if attempt < max_retries - 1 && status.is_server_error() {
                on_chunk(&format!(
                    "\n\n[服务端错误，正在重试 ({}/{})...]\n\n",
                    attempt + 2,
                    max_retries
                ))?;
                tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
                continue;
            }
            return Err(AppError::AiFailed(format!(
                "API 返回错误 {}: {}",
                status, body
            )));
        }

        let mut full_text = String::new();
        let mut buffer = String::new();

        match stream_openai_response(resp, &mut buffer, &mut full_text, &on_chunk).await {
            Ok(()) => return Ok(full_text),
            Err(_) if attempt < max_retries - 1 => {
                on_chunk(&format!(
                    "\n\n[连接中断，正在重试 ({}/{})...]\n\n",
                    attempt + 2,
                    max_retries
                ))?;
                tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
                continue;
            }
            Err(e) => return Err(e),
        }
    }

    unreachable!()
}

async fn stream_openai_response<F>(
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
