use std::time::Duration;

use reqwest::Client;
use serde::Serialize;

use crate::domain::config::{AppConfig, Provider};
use crate::error::{AppError, Result};

pub mod ollama;
pub mod openai;

#[derive(Serialize)]
pub(crate) struct Message {
    pub role: String,
    pub content: String,
}

pub async fn generate(config: &AppConfig, prompt: &str) -> Result<String> {
    match config.provider {
        Provider::Ollama => ollama::generate(config, prompt).await,
        Provider::OpenAI => openai::generate(config, prompt).await,
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
        Provider::Ollama => ollama::generate_streaming(config, prompt, on_chunk).await,
        Provider::OpenAI => openai::generate_streaming(config, prompt, on_chunk).await,
    }
}

pub(crate) fn build_client(timeout_secs: u64) -> Result<Client> {
    Ok(Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()?)
}

pub(crate) fn retry_delay(attempt: u32) -> Duration {
    Duration::from_secs(2u64.pow(attempt))
}

/// Returns Err after all retries are exhausted, replacing unreachable!().
pub(crate) fn retries_exhausted() -> AppError {
    AppError::AiFailed("重试次数耗尽".to_string())
}
