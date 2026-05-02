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
