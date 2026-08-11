use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::{serialize_loras, SceneDescription};
use crate::domain::config::{fill_template, AppConfig};
use crate::error::{AppError, Result};
use crate::services::ai;

#[derive(Serialize)]
struct ModelScopeImageRequest {
    model: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    loras: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct ModelScopeSubmitResponse {
    task_id: String,
}

#[derive(Deserialize)]
struct ModelScopeTaskResponse {
    task_status: String,
    output_images: Option<Vec<String>>,
    message: Option<String>,
    error: Option<String>,
}

pub struct GeneratedImageData {
    pub bytes: Vec<u8>,
}

fn normalize_base_url(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

pub async fn generate_image<F>(
    config: &AppConfig,
    prompt: &str,
    mut on_status: F,
) -> Result<GeneratedImageData>
where
    F: FnMut(&str),
{
    let base_url = normalize_base_url(config.image_api_base_url());
    let api_key = config.image_api_key();

    if api_key.is_empty() {
        return Err(AppError::Image(
            "ModelScope API Key 未配置，请在设置中填写".to_string(),
        ));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(config.timeout))
        .build()?;

    let loras = serialize_loras(&config.image_loras)?;
    let request = ModelScopeImageRequest {
        model: config.image_model.clone(),
        prompt: prompt.to_string(),
        loras,
    };

    // Phase 1: submit async task
    on_status("正在提交图片生成任务...");
    let url = format!("{}/v1/images/generations", base_url);

    let task_id = {
        let max_retries = 3;
        let mut task_id = None;
        for attempt in 0..max_retries {
            let resp = match client
                .post(&url)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .header("X-ModelScope-Async-Mode", "true")
                .json(&request)
                .send()
                .await
            {
                Ok(r) => r,
                Err(_) if attempt < max_retries - 1 => {
                    tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
                    continue;
                }
                Err(e) => return Err(AppError::Image(e.to_string())),
            };

            let status = resp.status();
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                if attempt < max_retries - 1 && status.is_server_error() {
                    tokio::time::sleep(Duration::from_secs(2u64.pow(attempt as u32))).await;
                    continue;
                }
                return Err(AppError::Image(format!(
                    "提交任务失败 {}: {}",
                    status, body
                )));
            }

            let submit_resp: ModelScopeSubmitResponse = resp.json().await?;
            task_id = Some(submit_resp.task_id);
            break;
        }
        task_id.ok_or_else(|| AppError::Image("未能获取任务 ID".to_string()))?
    };

    on_status(&format!("任务已提交，等待生成 (ID: {})", task_id));

    // Phase 2: poll task status
    let poll_url = format!("{}/v1/tasks/{}", base_url, task_id);
    let poll_interval = Duration::from_secs(3);
    let max_poll_duration = Duration::from_secs(config.timeout);
    let start = std::time::Instant::now();

    let image_url = loop {
        if start.elapsed() > max_poll_duration {
            return Err(AppError::Image("图片生成超时，请稍后重试".to_string()));
        }

        tokio::time::sleep(poll_interval).await;

        let resp = client
            .get(&poll_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("X-ModelScope-Task-Type", "image_generation")
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Image(format!(
                "查询任务状态失败 {}: {}",
                status, body
            )));
        }

        let task_resp: ModelScopeTaskResponse = resp.json().await?;

        match task_resp.task_status.as_str() {
            "SUCCEED" => {
                let urls = task_resp
                    .output_images
                    .ok_or_else(|| AppError::Image("任务成功但未返回图片".to_string()))?;
                break urls
                    .into_iter()
                    .next()
                    .ok_or_else(|| AppError::Image("任务成功但图片列表为空".to_string()))?;
            }
            "FAILED" => {
                let reason = task_resp
                    .message
                    .or(task_resp.error)
                    .unwrap_or_else(|| "ModelScope 未返回失败原因".to_string());
                return Err(AppError::Image(format!("图片生成任务失败: {}", reason)));
            }
            _ => {
                on_status("图片生成中，请稍候...");
                continue;
            }
        }
    };

    // Phase 3: download
    on_status("图片已生成，正在下载...");
    let bytes = download_image(&client, &image_url).await?;

    Ok(GeneratedImageData { bytes })
}

pub async fn download_image(client: &reqwest::Client, url: &str) -> Result<Vec<u8>> {
    let resp = client.get(url).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::Image(format!(
            "下载图片失败: HTTP {}",
            resp.status()
        )));
    }
    let bytes = resp.bytes().await?;
    Ok(bytes.to_vec())
}

/// 调用 LLM 从章节正文中提取场景视觉描述。
/// 按字符截断（修复原 content[:3000] 按字节截断导致 UTF-8 断裂的 bug）。
pub async fn extract_scene(config: &AppConfig, chapter_text: &str) -> Result<SceneDescription> {
    let truncated: String = chapter_text.chars().take(3000).collect();
    let prompt = fill_template(
        &config.image_prompts.extract_scene,
        &[("content", &truncated)],
    );

    let response = ai::generate(config, &prompt).await?;

    let cleaned = response
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let desc: SceneDescription = serde_json::from_str(cleaned)
        .map_err(|e| AppError::Image(format!("解析场景描述失败: {}\n原始响应: {}", e, cleaned)))?;

    Ok(desc)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_base_url_removes_trailing_slash() {
        assert_eq!(
            normalize_base_url("https://api-inference.modelscope.cn/"),
            "https://api-inference.modelscope.cn"
        );
    }
}
