use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::error::{AppError, Result};

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OllamaOptions {
    num_ctx: u32,
}

#[derive(Deserialize)]
struct OllamaResponse {
    message: OllamaMessage,
}

#[derive(Deserialize)]
struct OllamaMessage {
    content: String,
}

pub async fn generate(config: &AppConfig, prompt: &str) -> Result<String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(config.timeout))
        .build()?;

    let url = format!("{}/api/chat", config.ollama_url);
    let max_retries = 3;

    for attempt in 0..max_retries {
        let request = OllamaRequest {
            model: config.model.clone(),
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
                return Err(AppError::OllamaFailed(e.to_string()));
            }
        }
    }

    unreachable!()
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

pub async fn generate_streaming<F>(
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
            model: config.model.clone(),
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

                match stream_response(resp, &mut buffer, &mut full_text, &on_chunk).await {
                    Ok(()) => return Ok(full_text),
                    Err(_e) if attempt < max_retries - 1 => {
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
                return Err(AppError::OllamaFailed(e.to_string()));
            }
        }
    }

    unreachable!()
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
                return Err(AppError::OllamaFailed(err));
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
