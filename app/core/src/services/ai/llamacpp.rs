//! llama.cpp (llama-server) provider。
//!
//! llama.cpp 自带的 llama-server 暴露 **OpenAI 兼容 API**（`/v1/chat/completions`），
//! 因此本 provider 直接复用 `OpenAIProvider` 的全部逻辑（请求构造 / 重试 / 流式解析）。
//!
//! 与 OpenAI 的唯一差异是默认 base_url：llama-server 默认监听 `http://localhost:8080`。
//! 该默认值由 `AppConfig::ai_base_url()` 在 `api_base_url` 为空时提供，
//! `OpenAIProvider` 已通过 `ai_base_url()` 解析 base，故零额外逻辑。
//!
//! 这是一个 P1-6「AI 重试逻辑去重」的样板：OpenAI 兼容协议的 provider 无需各写一份。

use super::openai::OpenAIProvider;

/// llama.cpp provider = OpenAI 协议 provider（别名复用，避免代码重复）。
pub type LlamaCppProvider = OpenAIProvider;
