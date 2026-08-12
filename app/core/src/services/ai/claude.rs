//! Anthropic Claude provider。
//!
//! 协议要点（参照 https://docs.anthropic.com/en/api/messages）：
//! - 端点 `POST {base_url}/v1/messages`（注意不是 /v1/chat/completions）。
//! - Headers：`x-api-key`、`anthropic-version: 2023-06-01`、`content-type`。
//! - Body：`{model, max_tokens, messages:[{role,content}], stream}`。
//! - system 是顶层字段而非 messages 首项；本 provider 的 prompt 为单段字符串，
//!   直接作为单条 user message，无需 system 字段。
//! - 非流式：文本在 `content[].text`（content 是 block 数组，每个 text block 含 `.text`）。
//! - 流式 SSE：`content_block_delta` 的 `delta.text` 为增量；`message_stop` 为结束。

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::domain::config::AppConfig;
use crate::error::{AppError, Result};

use super::{build_client, retries_exhausted, retry_delay, AiProvider};

const MAX_RETRIES: u32 = 3;
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MAX_TOKENS: u32 = 8192;

#[derive(Default)]
pub struct ClaudeProvider;

impl ClaudeProvider {
    pub fn new() -> Self {
        ClaudeProvider
    }
}

// ── 请求 / 响应类型 ──

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
    stream: bool,
}

#[derive(Serialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContentBlock>,
}

#[derive(Deserialize)]
struct ClaudeContentBlock {
    #[serde(default)]
    text: Option<String>,
}

// ── 流式 SSE 事件 ──

#[derive(Deserialize)]
struct ClaudeStreamEvent {
    #[serde(default)]
    r#type: String,
    #[serde(default)]
    delta: Option<ClaudeDelta>,
    #[serde(default)]
    error: Option<ClaudeErrorBody>,
}

#[derive(Deserialize)]
struct ClaudeDelta {
    #[serde(rename = "type")]
    delta_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Deserialize)]
struct ClaudeErrorBody {
    message: Option<String>,
}

#[async_trait]
impl AiProvider for ClaudeProvider {
    async fn generate(&self, config: &AppConfig, prompt: &str) -> Result<String> {
        let client = build_client(config.timeout)?;
        let url = format!("{}/v1/messages", config.ai_base_url());

        for attempt in 0..MAX_RETRIES {
            let request = ClaudeRequest {
                model: config.active_model().to_string(),
                max_tokens: MAX_TOKENS,
                messages: vec![ClaudeMessage {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                }],
                stream: false,
            };

            let resp = match client
                .post(&url)
                .header("x-api-key", &config.api_key)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .header("content-type", "application/json")
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

            let body: ClaudeResponse = resp.json().await?;
            // 拼接所有 text block 的内容（通常只有一个 text block）。
            let text: String = body
                .content
                .into_iter()
                .filter_map(|b| b.text)
                .collect::<Vec<_>>()
                .join("");
            if text.is_empty() {
                return Err(AppError::AiFailed("API 返回空响应".to_string()));
            }
            return Ok(text);
        }
        Err(retries_exhausted())
    }

    async fn generate_streaming<F>(
        &self,
        config: &AppConfig,
        prompt: &str,
        on_chunk: F,
    ) -> Result<String>
    where
        F: Fn(&str) -> Result<()> + Send + Sync + 'static,
        Self: Sized,
    {
        let client = build_client(config.timeout * 2)?;
        let url = format!("{}/v1/messages", config.ai_base_url());

        for attempt in 0..MAX_RETRIES {
            let request = ClaudeRequest {
                model: config.active_model().to_string(),
                max_tokens: MAX_TOKENS,
                messages: vec![ClaudeMessage {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                }],
                stream: true,
            };

            let resp = match client
                .post(&url)
                .header("x-api-key", &config.api_key)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .header("content-type", "application/json")
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
}

/// 解析 Claude SSE 流。
///
/// 每个事件由 `event: <type>` 行 + `data: <json>` 行组成。我们只关心 data 行的
/// JSON：`type == "content_block_delta"` 且 `delta.type == "text_delta"` 时取
/// `delta.text`；`type == "message_stop"` 表示流结束；`type == "error"` 抛错。
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

            let data = match line.strip_prefix("data: ") {
                Some(d) => d,
                // event:/空行等非 data 行忽略
                None => continue,
            };

            let parsed: ClaudeStreamEvent = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            // 优先处理错误事件
            if let Some(err) = parsed.error {
                if let Some(msg) = err.message {
                    return Err(AppError::AiFailed(msg));
                }
            }

            match parsed.r#type.as_str() {
                "content_block_delta" => {
                    if let Some(delta) = parsed.delta {
                        // 仅 text_delta 携带正文；input_json_delta/thinking_delta 等忽略
                        let is_text = delta
                            .delta_type
                            .as_deref()
                            .map(|t| t == "text_delta")
                            .unwrap_or(true);
                        if is_text {
                            if let Some(text) = delta.text {
                                if !text.is_empty() {
                                    on_chunk(&text)?;
                                    full_text.push_str(&text);
                                }
                            }
                        }
                    }
                }
                "message_stop" => return Ok(()),
                // ping / message_start / content_block_start/stop / message_delta 等忽略
                _ => {}
            }
        }
    }

    Ok(())
}
