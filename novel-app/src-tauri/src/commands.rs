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
) -> Result<()> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
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
) -> Result<()> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;

    {
        let mut status = state.outline_generation.lock().unwrap();
        if status.running {
            return Ok(());
        }
        *status = OutlineGenerationStatus {
            running: true,
            completed: false,
            current_step: Some("world".to_string()),
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
