use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::ai;
use crate::config::{AppConfig, ImagePrompts};
use crate::error::{AppError, Result};
use crate::files;

// ===== 公开数据结构 =====

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ImageKind {
    Cover,
    Character,
    Scene,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageResult {
    pub id: String,
    pub kind: ImageKind,
    pub prompt: String,
    pub revised_prompt: Option<String>,
    pub local_path: String,
    pub file_size: u64,
    pub created: String,
    pub ref_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneDescription {
    pub scene_desc: String,
    pub mood: String,
}

// ===== ModelScope Z-Image API 类型 =====

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
}

pub struct GeneratedImageData {
    pub bytes: Vec<u8>,
}

fn serialize_loras(config: &crate::config::LoraConfig) -> Option<serde_json::Value> {
    if config.entries.is_empty() {
        return None;
    }
    if config.entries.len() == 1 && config.entries[0].weight.is_none() {
        return Some(serde_json::Value::String(config.entries[0].name.clone()));
    }
    let mut map = serde_json::Map::new();
    for entry in &config.entries {
        let weight = entry
            .weight
            .unwrap_or_else(|| 1.0_f64 / config.entries.len() as f64);
        map.insert(entry.name.clone(), serde_json::Value::from(weight));
    }
    Some(serde_json::Value::Object(map))
}

// ===== Prompt 构建 =====

pub fn build_cover_prompt(prompts: &ImagePrompts, title: &str, genre: &str, theme: &str) -> String {
    crate::config::fill_template(
        &prompts.cover,
        &[
            ("title", title),
            ("genre", genre),
            ("theme", theme),
            ("style_prefix", &prompts.style_prefix),
        ],
    )
}

pub fn build_character_prompt(
    prompts: &ImagePrompts,
    title: &str,
    name: &str,
    desc: &str,
) -> String {
    crate::config::fill_template(
        &prompts.character_image,
        &[
            ("title", title),
            ("character_name", name),
            ("character_desc", desc),
            ("style_prefix", &prompts.style_prefix),
        ],
    )
}

pub fn build_scene_prompt(
    prompts: &ImagePrompts,
    title: &str,
    chapter_num: u32,
    chapter_title: &str,
    scene_desc: &str,
    mood: &str,
) -> String {
    crate::config::fill_template(
        &prompts.scene,
        &[
            ("title", title),
            ("chapter_num", &chapter_num.to_string()),
            ("chapter_title", chapter_title),
            ("scene_desc", scene_desc),
            ("mood", mood),
            ("style_prefix", &prompts.style_prefix),
        ],
    )
}

// ===== 图片生成 =====

pub async fn generate_image<F>(
    config: &AppConfig,
    prompt: &str,
    mut on_status: F,
) -> Result<GeneratedImageData>
where
    F: FnMut(&str),
{
    let base_url = config.image_api_base_url();
    let api_key = config.image_api_key();

    if api_key.is_empty() {
        return Err(AppError::Image(
            "ModelScope API Key 未配置，请在设置中填写".to_string(),
        ));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(config.timeout))
        .build()?;

    let loras = serialize_loras(&config.image_loras);
    let request = ModelScopeImageRequest {
        model: config.image_model.clone(),
        prompt: prompt.to_string(),
        loras,
    };

    // Phase 1: 提交异步任务
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

    // Phase 2: 轮询任务状态
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
                let urls = task_resp.output_images.ok_or_else(|| {
                    AppError::Image("任务成功但未返回图片".to_string())
                })?;
                break urls.into_iter().next().ok_or_else(|| {
                    AppError::Image("任务成功但图片列表为空".to_string())
                })?;
            }
            "FAILED" => {
                return Err(AppError::Image("图片生成任务失败".to_string()));
            }
            _ => {
                on_status("图片生成中，请稍候...");
                continue;
            }
        }
    };

    // Phase 3: 下载图片
    on_status("图片已生成，正在下载...");
    let bytes = download_image(&client, &image_url).await?;

    Ok(GeneratedImageData { bytes })
}

async fn download_image(client: &reqwest::Client, url: &str) -> Result<Vec<u8>> {
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

// ===== 场景描述提取 =====

pub async fn extract_scene(config: &AppConfig, chapter_text: &str) -> Result<SceneDescription> {
    let truncated = &chapter_text[..chapter_text.len().min(3000)];
    let prompt = crate::config::fill_template(
        &config.image_prompts.extract_scene,
        &[("content", truncated)],
    );

    let response = ai::generate(config, &prompt).await?;

    let cleaned = response
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let desc: SceneDescription = serde_json::from_str(cleaned).map_err(|e| {
        AppError::Image(format!("解析场景描述失败: {}\n原始响应: {}", e, cleaned))
    })?;

    Ok(desc)
}

// ===== 图片存储 =====

pub fn images_dir(dir: &Path) -> PathBuf {
    dir.join("images")
}

pub fn images_meta_file(dir: &Path) -> PathBuf {
    images_dir(dir).join("meta.json")
}

pub fn save_image_file(
    dir: &Path,
    kind: &ImageKind,
    id: &str,
    bytes: &[u8],
) -> Result<String> {
    let img_dir = images_dir(dir);
    std::fs::create_dir_all(&img_dir)?;

    let prefix = match kind {
        ImageKind::Cover => "cover",
        ImageKind::Character => "char",
        ImageKind::Scene => "scene",
    };
    let filename = format!("{}_{}.png", prefix, id);
    let file_path = img_dir.join(&filename);
    std::fs::write(&file_path, bytes)?;

    Ok(filename)
}

pub fn list_images(dir: &Path) -> Result<Vec<ImageResult>> {
    let meta_path = images_meta_file(dir);
    if !meta_path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&meta_path)?;
    let images: Vec<ImageResult> = serde_json::from_str(&content)?;
    Ok(images)
}

pub fn append_image_meta(dir: &Path, result: &ImageResult) -> Result<()> {
    let mut images = list_images(dir)?;
    images.push(result.clone());
    save_all_images_meta(dir, &images)
}

pub fn save_all_images_meta(dir: &Path, images: &[ImageResult]) -> Result<()> {
    let img_dir = images_dir(dir);
    std::fs::create_dir_all(&img_dir)?;
    let content = serde_json::to_string_pretty(images)?;
    files::write_file_atomic(&images_meta_file(dir), &content)
}

pub fn delete_image(dir: &Path, image_id: &str) -> Result<()> {
    let mut images = list_images(dir)?;
    let img_dir = images_dir(dir);

    images.retain(|img| {
        if img.id == image_id {
            let path = img_dir.join(&img.local_path);
            let _ = std::fs::remove_file(path);
            false
        } else {
            true
        }
    });

    save_all_images_meta(dir, &images)
}

pub fn generate_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("{:x}", ts)
}
