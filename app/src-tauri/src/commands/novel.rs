use std::collections::HashMap;

use tauri::{Emitter, Manager, State};

use super::{config_from_state, dir_from_state};
use crate::domain::novel;
use crate::dto::{ChapterContentDto, ChapterMetaDto, NovelStatusDto, OutlineGenerationStatusDto};
use crate::error::Result;
use crate::state::{AppState, OutlineGenerationStatus};

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
        // 经 DTO 转换：步骤名 "world" → "worldView"，与轮询契约一致。
        let snapshot_dto: OutlineGenerationStatusDto = status_snapshot.into();
        let _ = app_for_task.emit("outline-generation-status", snapshot_dto);
    });

    Ok(())
}

#[tauri::command]
pub fn get_outline_generation_status(
    state: State<'_, AppState>,
) -> Result<OutlineGenerationStatusDto> {
    Ok(state
        .outline_generation
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .into())
}

#[tauri::command]
pub async fn generate_chapter(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<u32> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    crate::domain::chapter::generate_chapter_streaming(&dir, &config, &app).await
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> Result<NovelStatusDto> {
    let dir = dir_from_state(&state)?;
    Ok(novel::get_status(&dir)?.into())
}

#[tauri::command]
pub fn list_chapters(state: State<'_, AppState>) -> Result<Vec<ChapterMetaDto>> {
    let dir = dir_from_state(&state)?;
    let ch_dir = crate::services::files::chapters_dir(&dir);
    if !ch_dir.exists() {
        return Ok(Vec::new());
    }

    // 领域 ChapterMeta 无 filename 字段，遍历目录取真实文件名注入 DTO。
    // 与 services::files::list_chapters 一致的解析逻辑，但保留文件名。
    let mut entries: Vec<ChapterMetaDto> = Vec::new();
    for entry in std::fs::read_dir(&ch_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let content = content.replace("\r\n", "\n");
        let (meta_yaml, _) = crate::services::files::parse_yaml_front_matter(&content);
        if meta_yaml.is_null() {
            continue;
        }
        let Ok(meta) = serde_yaml::from_value::<crate::domain::types::ChapterMeta>(meta_yaml)
        else {
            continue;
        };
        let filename = entry
            .file_name()
            .to_string_lossy()
            .to_string();
        entries.push(ChapterMetaDto::from_meta(meta, filename));
    }
    entries.sort_by_key(|c| c.number);
    Ok(entries)
}

#[tauri::command]
pub fn read_chapter(state: State<'_, AppState>, filename: String) -> Result<ChapterContentDto> {
    let dir = dir_from_state(&state)?;
    let (meta, body) = crate::services::files::read_chapter(&dir, &filename)?;
    Ok(ChapterContentDto::from_parts(meta, filename, body))
}
