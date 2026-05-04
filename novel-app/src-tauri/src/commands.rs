use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Emitter, Manager, State};

use crate::config::AppConfig;
use crate::error::Result;
use crate::files::ChapterMeta;
use crate::novel::{self, NovelStatus};

pub struct AppState {
    pub novel_dir: Mutex<Option<PathBuf>>,
    pub config_path: Mutex<PathBuf>,
    pub outline_generation: Mutex<OutlineGenerationStatus>,
}

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineGenerationStatus {
    pub running: bool,
    pub completed: bool,
    pub current_step: Option<String>,
    pub streaming_text: HashMap<String, String>,
    pub error: Option<String>,
}

fn dir_from_state(state: &State<AppState>) -> Result<PathBuf> {
    state
        .novel_dir
        .lock()
        .unwrap()
        .clone()
        .ok_or(crate::error::AppError::NoNovelDir)
}

fn config_from_state(state: &State<AppState>) -> Result<AppConfig> {
    let config_path = state.config_path.lock().unwrap().clone();
    crate::config::load_config(&config_path)
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
    *state.novel_dir.lock().unwrap() = Some(dir);
    // 持久化到配置文件
    let config_path = state.config_path.lock().unwrap().clone();
    let mut config = crate::config::load_config(&config_path).unwrap_or_default();
    config.novel_dir = Some(dir_str.clone());
    let _ = crate::config::save_config(&config_path, &config);
    Ok(dir_str)
}

#[tauri::command]
pub fn get_novel_dir(state: State<'_, AppState>) -> Result<Option<String>> {
    Ok(state
        .novel_dir
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn create_novel(
    state: State<'_, AppState>,
    title: String,
    genre: String,
    theme: String,
    chapters: u32,
    overwrite: Option<bool>,
    prompts_override: Option<crate::config::Prompts>,
) -> Result<()> {
    let dir = dir_from_state(&state)?;
    let mut config = config_from_state(&state)?;
    if let Some(p) = prompts_override {
        config.prompts = p;
    }
    novel::create_novel(
        &dir,
        &title,
        &genre,
        &theme,
        chapters,
        &config,
        overwrite.unwrap_or(false),
    )
}

#[tauri::command]
pub async fn generate_outline(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<String> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    novel::generate_outline_streaming(&dir, &config, &app).await
}

#[tauri::command]
pub async fn start_outline_generation(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    step: Option<String>,
) -> Result<()> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    let target_step = step.unwrap_or_default();

    {
        let mut status = state.outline_generation.lock().unwrap();
        if status.running {
            return Ok(());
        }
        *status = OutlineGenerationStatus {
            running: true,
            completed: false,
            current_step: Some(target_step.clone()),
            streaming_text: HashMap::new(),
            error: None,
        };
    }

    let app_for_task = app.clone();
    tauri::async_runtime::spawn(async move {
        let app_for_progress = app_for_task.clone();
        let result = novel::generate_outline_streaming_with_progress(
            &dir,
            &config,
            &app_for_task,
            &target_step,
            move |step, chunk, _done| {
                let state = app_for_progress.state::<AppState>();
                let mut status = state.outline_generation.lock().unwrap();
                status.current_step = Some(step.to_string());
                if !chunk.is_empty() {
                    status
                        .streaming_text
                        .entry(step.to_string())
                        .or_default()
                        .push_str(chunk);
                }
            },
        )
        .await;

        let state = app_for_task.state::<AppState>();
        let status_snapshot = {
            let mut status = state.outline_generation.lock().unwrap();
            status.running = false;
            status.completed = result.is_ok();
            status.error = result.err().map(|e| e.to_string());
            status.clone()
        };
        let _ = app_for_task.emit("outline-generation-status", status_snapshot);
    });

    Ok(())
}

#[tauri::command]
pub fn get_outline_generation_status(
    state: State<'_, AppState>,
) -> Result<OutlineGenerationStatus> {
    Ok(state.outline_generation.lock().unwrap().clone())
}

#[tauri::command]
pub async fn generate_chapter(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<u32> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    novel::generate_chapter_streaming(&dir, &config, &app).await
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> Result<NovelStatus> {
    let dir = dir_from_state(&state)?;
    novel::get_status(&dir)
}

#[tauri::command]
pub fn list_chapters(state: State<'_, AppState>) -> Result<Vec<ChapterMeta>> {
    let dir = dir_from_state(&state)?;
    crate::files::list_chapters(&dir)
}

#[tauri::command]
pub fn read_chapter(state: State<'_, AppState>, filename: String) -> Result<ChapterContent> {
    let dir = dir_from_state(&state)?;
    let (meta, body) = crate::files::read_chapter(&dir, &filename)?;
    Ok(ChapterContent { meta, body })
}

#[derive(serde::Serialize)]
pub struct ChapterContent {
    pub meta: ChapterMeta,
    pub body: String,
}

#[tauri::command]
pub fn load_config(state: State<'_, AppState>) -> Result<AppConfig> {
    config_from_state(&state)
}

#[tauri::command]
pub fn save_config(state: State<'_, AppState>, config: AppConfig) -> Result<()> {
    let config_path = state.config_path.lock().unwrap().clone();
    crate::config::save_config(&config_path, &config)
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
        return Err(crate::error::AppError::AiFailed(
            format!("Ollama 连接失败: HTTP {}", resp.status())
        ));
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

// 导出命令

#[tauri::command]
pub fn get_export_data(state: State<'_, AppState>) -> Result<crate::export::ExportData> {
    let dir = dir_from_state(&state)?;
    crate::export::collect_export_data(&dir)
}

#[tauri::command]
pub async fn export_novel(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    format: String,
) -> Result<String> {
    use tauri_plugin_dialog::DialogExt;

    let dir = dir_from_state(&state)?;
    let data = crate::export::collect_export_data(&dir)?;

    let content = match format.as_str() {
        "md" => crate::export::render_markdown(&data),
        "txt" => crate::export::render_plain_text(&data),
        _ => {
            return Err(crate::error::AppError::Export(format!(
                "不支持的格式: {}",
                format
            )))
        }
    };

    let ext = format.clone();
    let default_name = format!("{}.{}", data.novel.title, ext);
    let file_path = app
        .dialog()
        .file()
        .add_filter(&format.to_uppercase(), &[&ext])
        .set_file_name(&default_name)
        .blocking_save_file()
        .ok_or(crate::error::AppError::Export("用户取消导出".into()))?;

    let path = file_path
        .as_path()
        .ok_or(crate::error::AppError::Export("无效文件路径".into()))?;

    std::fs::write(path, content)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_export_file(
    app: tauri::AppHandle,
    content: Vec<u8>,
    filename: String,
    extension: String,
) -> Result<String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .add_filter(&extension.to_uppercase(), &[&extension])
        .set_file_name(&filename)
        .blocking_save_file()
        .ok_or(crate::error::AppError::Export("用户取消导出".into()))?;

    let path = file_path
        .as_path()
        .ok_or(crate::error::AppError::Export("无效文件路径".into()))?;

    std::fs::write(path, content)?;
    Ok(path.to_string_lossy().to_string())
}
