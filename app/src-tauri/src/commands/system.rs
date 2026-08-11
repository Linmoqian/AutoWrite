use std::path::PathBuf;

use tauri::{Manager, State};

use super::config_from_state;
use crate::domain::config::Provider;
use crate::error::Result;
use crate::state::AppState;

pub fn allow_image_assets(app: &tauri::AppHandle, dir: &std::path::Path) -> Result<()> {
    app.asset_protocol_scope()
        .allow_directory(crate::services::image::images_dir(dir), true)
        .map_err(|e| crate::error::AppError::Image(format!("图片预览授权失败: {}", e)))
}

#[tauri::command]
pub async fn select_novel_dir(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or(crate::error::AppError::NoNovelDir)?;
    let dir: PathBuf = file_path
        .as_path()
        .ok_or(crate::error::AppError::NoNovelDir)?
        .to_path_buf();
    let dir_str = dir.to_string_lossy().to_string();
    allow_image_assets(&app, &dir)?;
    *state.novel_dir.lock().unwrap_or_else(|e| e.into_inner()) = Some(dir);
    let config_path = state
        .config_path
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let mut config = crate::services::config::load_config(&config_path).unwrap_or_default();
    config.novel_dir = Some(dir_str.clone());
    let _ = crate::services::config::save_config(&config_path, &config);
    Ok(dir_str)
}

#[tauri::command]
pub fn get_novel_dir(state: State<'_, AppState>) -> Result<Option<String>> {
    Ok(state
        .novel_dir
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
        .map(|p| p.to_string_lossy().to_string()))
}

#[derive(serde::Serialize)]
pub struct ConnectionTestResult {
    pub connected: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn test_ai_connection(state: State<'_, AppState>) -> Result<ConnectionTestResult> {
    let config = config_from_state(&state)?;

    match config.provider {
        Provider::OpenAI => test_openai_connection(&config).await,
        Provider::Ollama => test_ollama_connection(&config).await,
    }
}

async fn test_openai_connection(
    config: &crate::domain::config::AppConfig,
) -> Result<ConnectionTestResult> {
    if config.api_key.is_empty() {
        return Ok(ConnectionTestResult {
            connected: false,
            latency_ms: 0,
            error: Some("未配置 API Key，请在「模型配置」页面填写".to_string()),
        });
    }
    if config.api_base_url.is_empty() {
        return Ok(ConnectionTestResult {
            connected: false,
            latency_ms: 0,
            error: Some("未配置 API 地址，请在「模型配置」页面填写".to_string()),
        });
    }

    let url = format!("{}/v1/models", config.api_base_url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let start = std::time::Instant::now();
    let result = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .send()
        .await;
    let latency_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(resp) if resp.status().is_success() => Ok(ConnectionTestResult {
            connected: true,
            latency_ms,
            error: None,
        }),
        Ok(resp) => {
            let status = resp.status();
            let hint = if status.as_u16() == 401 {
                "API Key 无效或已过期，请检查「模型配置」".to_string()
            } else {
                format!("API 返回错误 HTTP {}", status)
            };
            Ok(ConnectionTestResult {
                connected: false,
                latency_ms,
                error: Some(hint),
            })
        }
        Err(e) => Ok(ConnectionTestResult {
            connected: false,
            latency_ms,
            error: Some(format!("连接失败: {}", e)),
        }),
    }
}

async fn test_ollama_connection(
    config: &crate::domain::config::AppConfig,
) -> Result<ConnectionTestResult> {
    if config.ollama_url.is_empty() {
        return Ok(ConnectionTestResult {
            connected: false,
            latency_ms: 0,
            error: Some("未配置 Ollama 地址，请在「模型配置」页面填写".to_string()),
        });
    }

    let url = format!("{}/api/tags", config.ollama_url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let start = std::time::Instant::now();
    let result = client.get(&url).send().await;
    let latency_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(resp) if resp.status().is_success() => Ok(ConnectionTestResult {
            connected: true,
            latency_ms,
            error: None,
        }),
        Ok(resp) => Ok(ConnectionTestResult {
            connected: false,
            latency_ms,
            error: Some(format!("Ollama 返回错误 HTTP {}", resp.status())),
        }),
        Err(e) => Ok(ConnectionTestResult {
            connected: false,
            latency_ms,
            error: Some(format!("Ollama 连接失败: {}。请确认 Ollama 已启动", e)),
        }),
    }
}
