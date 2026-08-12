//! Google Gemini provider。
//!
//! 协议要点（参照 https://ai.google.dev/api/generate-content）：
//! - 非流式端点：`POST {base}/v1beta/models/{model}:generateContent?key={api_key}`
//! - 流式端点：`POST {base}/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}`
//! - Body：`{contents:[{role:"user", parts:[{text:prompt}]}]}`
//! - 非流式响应：文本在 `candidates[].content.parts[].text`
//! - 流式响应：SSE，每个 data: 是完整的 GenerateContentResponse，文本位置同上。
//! - API key 通过 URL query 传递（非 header）。
//!
//! 模型名：用户在配置中填裸模型名（如 gemini-2.0-flash）。本 provider 自动补
//! `models/` 前缀（若用户已带前缀则不重复添加）。

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::domain::config::AppConfig;
use crate::error::{AppError, Result};

use super::{build_client, retries_exhausted, retry_delay, AiProvider};

const MAX_RETRIES: u32 = 3;

#[derive(Default)]
pub struct GeminiProvider;

impl GeminiProvider {
    pub fn new() -> Self {
        GeminiProvider
    }
}

// ── 请求 / 响应类型 ──

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
}

#[derive(Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    #[serde(default)]
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    #[serde(default)]
    content: Option<GeminiCandidateContent>,
}

#[derive(Deserialize)]
struct GeminiCandidateContent {
    #[serde(default)]
    parts: Vec<GeminiPartResp>,
}

#[derive(Deserialize)]
struct GeminiPartResp {
    #[serde(default)]
    text: Option<String>,
}

#[async_trait]
impl AiProvider for GeminiProvider {
    async fn generate(&self, config: &AppConfig, prompt: &str) -> Result<String> {
        let client = build_client(config.timeout)?;
        let url = build_url(config, "generateContent", false);

        for attempt in 0..MAX_RETRIES {
            let request = GeminiRequest {
                contents: vec![GeminiContent {
                    role: "user".to_string(),
                    parts: vec![GeminiPart {
                        text: prompt.to_string(),
                    }],
                }],
            };

            let resp = match client.post(&url).json(&request).send().await {
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

            let body: GeminiResponse = resp.json().await?;
            return extract_text(body).ok_or_else(|| AppError::AiFailed("API 返回空响应".to_string()));
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
        let url = build_url(config, "streamGenerateContent", true);

        for attempt in 0..MAX_RETRIES {
            let request = GeminiRequest {
                contents: vec![GeminiContent {
                    role: "user".to_string(),
                    parts: vec![GeminiPart {
                        text: prompt.to_string(),
                    }],
                }],
            };

            let resp = match client.post(&url).json(&request).send().await {
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

/// 构造 Gemini 请求 URL。
///
/// `streaming` 为 true 时附加 `alt=sse`；API key 始终通过 query 传递。
fn build_url(config: &AppConfig, action: &str, streaming: bool) -> String {
    let base = config.ai_base_url().trim_end_matches('/');
    let model = normalize_model(config.active_model());
    if streaming {
        format!(
            "{base}/v1beta/models/{model}:{action}?alt=sse&key={}",
            config.api_key
        )
    } else {
        format!(
            "{base}/v1beta/models/{model}:{action}?key={}",
            config.api_key
        )
    }
}

/// 确保模型名带 `models/` 前缀。用户可能填 `gemini-2.0-flash` 或
/// `models/gemini-2.0-flash`，二者都要正确处理。
fn normalize_model(model: &str) -> &str {
    if let Some(rest) = model.strip_prefix("models/") {
        rest
    } else {
        model
    }
}

/// 从单个 GenerateContentResponse 中提取拼接后的文本。
fn extract_text(resp: GeminiResponse) -> Option<String> {
    resp.candidates
        .into_iter()
        .next()
        .and_then(|c| c.content)
        .and_then(|content| {
            let text: String = content
                .parts
                .into_iter()
                .filter_map(|p| p.text)
                .collect::<Vec<_>>()
                .join("");
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        })
}

/// 解析 Gemini SSE 流（alt=sse）。
///
/// 每个 `data:` 行是一个完整的 GenerateContentResponse JSON。
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
                None => continue,
            };

            let parsed: GeminiResponse = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(text) = extract_text(parsed) {
                if !text.is_empty() {
                    on_chunk(&text)?;
                    full_text.push_str(&text);
                }
            }
        }
    }

    Ok(())
}
