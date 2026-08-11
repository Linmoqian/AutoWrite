use serde::{Deserialize, Serialize};

use crate::domain::config::AppConfig;
use crate::error::{AppError, Result};
use super::{build_client, Message, retry_delay, retries_exhausted};

const MAX_RETRIES: u32 = 3;

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
    num_predict: u32,
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

pub async fn generate(config: &AppConfig, prompt: &str) -> Result<String> {
    let client = build_client(config.timeout)?;
    let url = format!("{}/api/chat", config.ollama_url);

    for attempt in 0..MAX_RETRIES {
        let request = OllamaRequest {
            model: config.active_model().to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            stream: false,
            options: OllamaOptions {
                num_ctx: config.num_ctx,
                num_predict: 4096,
            },
        };

        match client.post(&url).json(&request).send().await {
            Ok(resp) => {
                let body: OllamaResponse = resp.json().await?;
                return Ok(body.message.content);
            }
            Err(_) if attempt < MAX_RETRIES - 1 => {
                tokio::time::sleep(retry_delay(attempt)).await;
            }
            Err(e) => return Err(AppError::AiFailed(e.to_string())),
        }
    }
    Err(retries_exhausted())
}

pub async fn generate_streaming<F>(config: &AppConfig, prompt: &str, on_chunk: F) -> Result<String>
where
    F: Fn(&str) -> Result<()>,
{
    let client = build_client(config.timeout * 2)?;
    let url = format!("{}/api/chat", config.ollama_url);

    for attempt in 0..MAX_RETRIES {
        let request = OllamaRequest {
            model: config.active_model().to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            stream: true,
            options: OllamaOptions {
                num_ctx: config.num_ctx,
                num_predict: 4096,
            },
        };

        match client.post(&url).json(&request).send().await {
            Ok(resp) => {
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
            Err(_) if attempt < MAX_RETRIES - 1 => {
                tokio::time::sleep(retry_delay(attempt)).await;
            }
            Err(e) => return Err(AppError::AiFailed(e.to_string())),
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
