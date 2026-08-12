use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;
use serde::Serialize;

use crate::domain::config::{AppConfig, Provider};
use crate::error::{AppError, Result};

pub mod claude;
pub mod gemini;
pub mod llamacpp;
pub mod ollama;
pub mod openai;

pub use claude::ClaudeProvider;
pub use gemini::GeminiProvider;
pub use llamacpp::LlamaCppProvider;
pub use ollama::OllamaProvider;
pub use openai::OpenAIProvider;

/// AI Provider 统一抽象。新增 provider 时实现该 trait 并在 `create_provider` 增加分支。
///
/// `generate_streaming` 含泛型回调，标注 `Self: Sized` 以排除出 trait 对象的 vtable，
/// 从而保证 `AiProvider` 整体对象安全，`create_provider` 可返回 `Box<dyn AiProvider>`。
/// 非泛型的 `generate` 可经 trait 对象分发；流式生成经具体类型静态分发。
#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn generate(&self, config: &AppConfig, prompt: &str) -> Result<String>;

    async fn generate_streaming<F>(
        &self,
        config: &AppConfig,
        prompt: &str,
        on_chunk: F,
    ) -> Result<String>
    where
        F: Fn(&str) -> Result<()> + Send + Sync + 'static,
        Self: Sized;
}

/// 根据 config.provider 创建对应 provider 实例。
pub fn create_provider(config: &AppConfig) -> Box<dyn AiProvider> {
    match config.provider {
        Provider::OpenAI => Box::new(OpenAIProvider::new()),
        Provider::Ollama => Box::new(OllamaProvider::new()),
        Provider::Claude => Box::new(ClaudeProvider::new()),
        Provider::Gemini => Box::new(GeminiProvider::new()),
        Provider::LlamaCpp => Box::new(LlamaCppProvider::new()),
    }
}

/// 便捷包装：通过 trait 对象分发非流式生成。
pub async fn generate(config: &AppConfig, prompt: &str) -> Result<String> {
    let provider = create_provider(config);
    provider.generate(config, prompt).await
}

/// 便捷包装：流式生成含泛型回调，无法经 trait 对象分发，改用静态分发。
pub async fn generate_streaming<F>(config: &AppConfig, prompt: &str, on_chunk: F) -> Result<String>
where
    F: Fn(&str) -> Result<()> + Send + Sync + 'static,
{
    match config.provider {
        Provider::OpenAI => {
            OpenAIProvider::new()
                .generate_streaming(config, prompt, on_chunk)
                .await
        }
        Provider::Ollama => {
            OllamaProvider::new()
                .generate_streaming(config, prompt, on_chunk)
                .await
        }
        Provider::Claude => {
            ClaudeProvider::new()
                .generate_streaming(config, prompt, on_chunk)
                .await
        }
        Provider::Gemini => {
            GeminiProvider::new()
                .generate_streaming(config, prompt, on_chunk)
                .await
        }
        Provider::LlamaCpp => {
            LlamaCppProvider::new()
                .generate_streaming(config, prompt, on_chunk)
                .await
        }
    }
}

#[derive(Serialize)]
pub struct Message {
    pub role: String,
    pub content: String,
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
