use std::collections::HashMap;

use tauri::{Emitter, Manager, State};

use crate::domain::types::ChapterMeta;
use crate::domain::novel;
use crate::error::Result;
use crate::state::{AppState, OutlineGenerationStatus};
use super::{config_from_state, dir_from_state};

#[derive(serde::Serialize)]
pub struct ChapterContent {
    pub meta: ChapterMeta,
    pub body: String,
}

#[tauri::command]
pub async fn create_novel(
    state: State<'_, AppState>,
    title: String,
    genre: String,
    theme: String,
    chapters: u32,
    overwrite: Option<bool>,
    prompts_override: Option<crate::domain::config::Prompts>,
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
pub async fn generate_outline(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String> {
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
        let mut status = state
            .outline_generation
            .lock()
            .unwrap_or_else(|e| e.into_inner());
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
                let mut status = state
                    .outline_generation
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
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
            let mut status = state
                .outline_generation
                .lock()
                .unwrap_or_else(|e| e.into_inner());
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
    Ok(state
        .outline_generation
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone())
}

#[tauri::command]
pub async fn generate_chapter(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<u32> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    crate::domain::chapter::generate_chapter_streaming(&dir, &config, &app).await
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> Result<novel::NovelStatus> {
    let dir = dir_from_state(&state)?;
    novel::get_status(&dir)
}

#[tauri::command]
pub fn list_chapters(state: State<'_, AppState>) -> Result<Vec<ChapterMeta>> {
    let dir = dir_from_state(&state)?;
    crate::services::files::list_chapters(&dir)
}

#[tauri::command]
pub fn read_chapter(state: State<'_, AppState>, filename: String) -> Result<ChapterContent> {
    let dir = dir_from_state(&state)?;
    let (meta, body) = crate::services::files::read_chapter(&dir, &filename)?;
    Ok(ChapterContent { meta, body })
}
