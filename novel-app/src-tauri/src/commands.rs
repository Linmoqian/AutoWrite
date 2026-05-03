use std::path::PathBuf;
use std::sync::Mutex;

use tauri::State;

use crate::config::AppConfig;
use crate::error::Result;
use crate::files::ChapterMeta;
use crate::novel::{self, NovelStatus};

pub struct AppState {
    pub novel_dir: Mutex<Option<PathBuf>>,
    pub config_path: Mutex<PathBuf>,
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
    let file_path = app.dialog().file().blocking_pick_folder()
        .ok_or(crate::error::AppError::NoNovelDir)?;
    let dir: PathBuf = file_path.as_path()
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
) -> Result<()> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    novel::create_novel(&dir, &title, &genre, &theme, chapters, &config)
}

#[tauri::command]
pub async fn generate_outline(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    novel::generate_outline_streaming(&dir, &config, &app).await
}

#[tauri::command]
pub async fn generate_chapter(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<u32> {
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
