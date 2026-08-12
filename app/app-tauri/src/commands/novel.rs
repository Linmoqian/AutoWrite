use std::collections::HashMap;

use autowrite_core::domain::util::map_step;
use autowrite_core::progress::{OutlineStep, ProgressEvent};
use tauri::{Emitter, Manager, State};

use super::{config_from_state, dir_from_state};
use crate::domain::novel;
use crate::dto::{ChapterContentDto, ChapterMetaDto, NovelStatusDto, OutlineGenerationStatusDto};
use crate::error::Result;
use crate::state::{AppState, OutlineGenerationStatus};

/// IPC 事件载荷：大纲生成流式进度（ADR-009 §3.1.4，留在 app 侧）。
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OutlineProgressEvent {
    step: String,
    chunk: String,
    done: bool,
}

/// IPC 事件载荷：章节生成流式进度（ADR-009 §3.1.4，留在 app 侧）。
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ChapterProgressEvent {
    chunk: String,
    done: bool,
}

/// 把 core 的 OutlineStep 映射回后端内部步骤名（与提示词模板、AppState key 对齐）。
/// AppState 的 streaming_text 用内部名（world/characters/outline）做 key，
/// emit 事件再经 map_step 映射成前端契约值（worldView/characters/outline）。
fn outline_step_internal(step: OutlineStep) -> &'static str {
    match step {
        OutlineStep::World => "world",
        OutlineStep::Characters => "characters",
        OutlineStep::Outline => "outline",
    }
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
pub async fn generate_outline(state: State<'_, AppState>) -> Result<String> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    novel::generate_outline_streaming(&dir, &config).await
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
        // 注入闭包（ADR-009 §3.1.4）：core 产出中性的 ProgressEvent，
        // 闭包内更新 AppState 并还原原 emit 语义。
        let result = novel::generate_outline_streaming_with_progress(
            &dir,
            &config,
            &target_step,
            move |ev: ProgressEvent| {
                if let ProgressEvent::OutlineStep { step, chunk, done } = ev {
                    let internal = outline_step_internal(step);
                    let contract = map_step(internal);

                    // 1. 更新 AppState（用内部步骤名做 streaming_text 的 key）
                    let state = app_for_progress.state::<AppState>();
                    let mut status = state
                        .outline_generation
                        .lock()
                        .unwrap_or_else(|e| e.into_inner());
                    status.current_step = Some(internal.to_string());
                    if !chunk.is_empty() {
                        status
                            .streaming_text
                            .entry(internal.to_string())
                            .or_default()
                            .push_str(&chunk);
                    }

                    // 2. 还原原 emit（OutlineProgressEvent 用前端契约步骤名）
                    let _ = app_for_progress.emit(
                        "outline-progress",
                        OutlineProgressEvent {
                            step: contract.to_string(),
                            chunk,
                            done,
                        },
                    );
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
    let app_for_emit = app.clone();
    crate::domain::chapter::generate_chapter_streaming(&dir, &config, move |ev: ProgressEvent| {
        if let ProgressEvent::ChapterChunk { chunk, done } = ev {
            let _ = app_for_emit.emit(
                "chapter-progress",
                ChapterProgressEvent { chunk, done },
            );
        }
    })
    .await
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
    // 路径穿越校验（P0-3）：确保 filename 不含 .. 或绝对路径，且 join 后在 dir 内
    let chapters_base = crate::services::files::chapters_dir(&dir);
    super::safe_join(&chapters_base, &filename)?;
    let (meta, body) = crate::services::files::read_chapter(&dir, &filename)?;
    Ok(ChapterContentDto::from_parts(meta, filename, body))
}
