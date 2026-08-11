use tauri::State;

use super::config_from_state;
use crate::domain::config::AppConfig;
use crate::dto::AppConfigDto;
use crate::error::Result;
use crate::state::AppState;

#[tauri::command]
pub fn load_config(state: State<'_, AppState>) -> Result<AppConfigDto> {
    let config = config_from_state(&state)?;
    Ok(config.into())
}

#[tauri::command]
pub fn save_config(state: State<'_, AppState>, config: AppConfigDto) -> Result<()> {
    let config_path = state
        .config_path
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone();

    // 前端不感知 novel_dir（IPC 契约无该字段），保存时保留磁盘现有值，避免丢失。
    let mut domain: AppConfig = config.into();
    if domain.novel_dir.is_none() {
        if let Ok(existing) = crate::services::config::load_config(&config_path) {
            domain.novel_dir = existing.novel_dir;
        }
    }

    crate::services::config::save_config(&config_path, &domain)
}

#[derive(serde::Serialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: String,
    pub modified: String,
}

#[tauri::command]
pub async fn ollama_list_models(state: State<'_, AppState>) -> Result<Vec<OllamaModel>> {
    let config = config_from_state(&state)?;
    let url = format!("{}/api/tags", config.ollama_url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let resp = client.get(&url).send().await?;
    if !resp.status().is_success() {
        return Err(crate::error::AppError::AiFailed(format!(
            "Ollama 连接失败: HTTP {}",
            resp.status()
        )));
    }

    let body: serde_json::Value = resp.json().await?;
    let mut models = Vec::new();
    if let Some(arr) = body["models"].as_array() {
        for m in arr {
            let size_bytes = m["size"].as_u64().unwrap_or(0);
            let size_str = if size_bytes >= 1_073_741_824 {
                format!("{:.1} GB", size_bytes as f64 / 1_073_741_824.0)
            } else {
                format!("{:.0} MB", size_bytes as f64 / 1_048_576.0)
            };
            models.push(OllamaModel {
                name: m["name"].as_str().unwrap_or("").to_string(),
                size: size_str,
                modified: m["modified_at"].as_str().unwrap_or("").to_string(),
            });
        }
    }
    Ok(models)
}

#[derive(serde::Serialize)]
pub struct OllamaTestResult {
    pub connected: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn ollama_test_connection(state: State<'_, AppState>) -> Result<OllamaTestResult> {
    let config = config_from_state(&state)?;
    let url = format!("{}/api/tags", config.ollama_url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let start = std::time::Instant::now();
    let result = client.get(&url).send().await;
    let latency_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(resp) if resp.status().is_success() => Ok(OllamaTestResult {
            connected: true,
            latency_ms,
            error: None,
        }),
        Ok(resp) => Ok(OllamaTestResult {
            connected: false,
            latency_ms,
            error: Some(format!("HTTP {}", resp.status())),
        }),
        Err(e) => Ok(OllamaTestResult {
            connected: false,
            latency_ms,
            error: Some(e.to_string()),
        }),
    }
}
