//! 批量场景插图生成命令（真并发用例）。
//!
//! 场景之间互相独立（不像章节生成有 context 依赖），可安全并发。
//! 从 `commands/image.rs` 拆出以遵守单文件 ≤300 行约束。

use std::path::{Path, PathBuf};
use std::sync::Arc;

use futures::StreamExt;
use tauri::State;

use super::{config_from_state, dir_from_state};
use super::image_batch_progress::{emit_batch_progress, fail, set_status};
use crate::domain::config::ImagePrompts;
use crate::domain::types::NovelData;
use crate::dto::{BatchChapterStatus, ImageResultDto};
use crate::error::Result;
use crate::services::image;
use crate::state::AppState;

/// 批量生成的最大并发数。受 ModelScope API 限流约束，过高易触发 429。
const BATCH_CONCURRENCY: usize = 3;

/// 单个章节在批量任务中的处理结果。
pub struct BatchChapterOutcome {
    pub chapter: u32,
    pub result: std::result::Result<image::ImageResult, String>,
}

/// 批量任务中跨章节共享的上下文。每个章节 task 克隆一份（内部 Arc，廉价）。
#[derive(Clone)]
struct BatchCtx {
    app: tauri::AppHandle,
    dir: PathBuf,
    novel: NovelData,
    config: Arc<crate::domain::config::AppConfig>,
    prompts: ImagePrompts,
    statuses: Arc<std::sync::Mutex<Vec<BatchChapterStatus>>>,
    meta_lock: Arc<std::sync::Mutex<()>>,
    total: u32,
}

/// 批量生成多章场景插图。场景之间互相独立，可安全并发。
///
/// 两阶段：并发提取每章场景描述 → 并发生成图片（buffer_unordered(3) 限流）。
/// 错误隔离：单章失败不阻塞其他章节。通过 `batch-image-progress` 事件实时推送
/// 整体进度 + 每章状态快照。
///
/// 并发写安全：`image::append_image_meta` 是非原子的 read-modify-write，多任务
/// 并发写会丢失更新（沉默逻辑错误）。这里用 `Arc<Mutex<()>>` 串行化元数据写入。
#[tauri::command]
pub async fn generate_scene_images_batch(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    chapter_nums: Vec<u32>,
) -> Result<Vec<ImageResultDto>> {
    if chapter_nums.is_empty() {
        return Err(crate::error::AppError::Image("未选择任何章节".to_string()));
    }

    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;
    let novel = crate::services::files::read_novel(&dir)?;
    let prepared = prepare_chapters(&dir, &chapter_nums)?;

    let total = chapter_nums.len() as u32;
    let statuses = Arc::new(std::sync::Mutex::new(
        chapter_nums
            .iter()
            .map(|&n| BatchChapterStatus {
                chapter: n,
                status: "pending".to_string(),
                message: None,
            })
            .collect(),
    ));
    let meta_lock = Arc::new(std::sync::Mutex::new(()));

    emit_batch_progress(&app, &statuses, total, None, None);

    let config = Arc::new(config);
    let scene_descs = extract_scenes_concurrent(&config, &prepared).await?;

    let prompts = config.image_prompts.clone();
    let app_for_final = app.clone();
    let ctx = BatchCtx {
        app,
        dir,
        novel,
        config,
        prompts,
        statuses: Arc::clone(&statuses),
        meta_lock: Arc::clone(&meta_lock),
        total,
    };
    let mut results = generate_scenes_concurrent(ctx, prepared, scene_descs).await;

    emit_batch_progress(&app_for_final, &statuses, total, None, None);

    // buffer_unordered 按完成顺序返回；按章节号排序保证结果稳定有序。
    results.sort_by_key(|o| o.chapter);

    let dtos = results
        .into_iter()
        .filter_map(|o| o.result.ok())
        .map(Into::into)
        .collect();

    Ok(dtos)
}

/// 预读每章正文 + 大纲标题，返回 (章号, 标题, 正文) 列表。
fn prepare_chapters(dir: &Path, chapter_nums: &[u32]) -> Result<Vec<(u32, String, String)>> {
    let chapters_meta = crate::services::files::list_chapters(dir)?;
    let mut prepared = Vec::with_capacity(chapter_nums.len());
    for &chapter_num in chapter_nums {
        let chapter_title = crate::services::files::get_chapter_outline(dir, chapter_num)?
            .unwrap_or_else(|| format!("第{}章", chapter_num));
        let chapter = chapters_meta
            .iter()
            .find(|c| c.chapter == chapter_num)
            .ok_or_else(|| {
                crate::error::AppError::Image(format!("第 {} 章不存在", chapter_num))
            })?;
        let filename = format!("{:03}-{}.md", chapter_num, chapter.title);
        let (_, body) = crate::services::files::read_chapter(dir, &filename)?;
        prepared.push((chapter_num, chapter_title, body));
    }
    Ok(prepared)
}

/// 并发提取每章场景描述（buffer_unordered 限流）。
/// 构造 owned 迭代器，避免 .iter() 借用与 async block 触发 HRTB 生命周期错误。
async fn extract_scenes_concurrent(
    config: &Arc<crate::domain::config::AppConfig>,
    prepared: &[(u32, String, String)],
) -> Result<std::collections::HashMap<u32, image::SceneDescription>> {
    let extract_items: Vec<(u32, String)> = prepared
        .iter()
        .map(|(chapter_num, _title, body)| (*chapter_num, body.clone()))
        .collect();
    let futs = extract_items.into_iter().map(|(chapter_num, body)| {
        let config = Arc::clone(config);
        async move { image::extract_scene(&config, &body).await.map(|d| (chapter_num, d)) }
    });
    futures::stream::iter(futs)
        .buffer_unordered(BATCH_CONCURRENCY)
        .collect::<Vec<_>>()
        .await
        .into_iter()
        .collect::<std::result::Result<_, _>>()
        .map_err(|e| crate::error::AppError::Image(format!("提取场景描述失败: {}", e)))
}

/// 并发生成场景图片（buffer_unordered 限流，单章失败隔离）。
async fn generate_scenes_concurrent(
    ctx: BatchCtx,
    prepared: Vec<(u32, String, String)>,
    scene_descs: std::collections::HashMap<u32, image::SceneDescription>,
) -> Vec<BatchChapterOutcome> {
    let futs = prepared.into_iter().map(|(chapter_num, chapter_title, _)| {
        generate_one_scene(
            ctx.clone(),
            chapter_num,
            chapter_title,
            scene_descs.get(&chapter_num).cloned(),
        )
    });
    futures::stream::iter(futs)
        .buffer_unordered(BATCH_CONCURRENCY)
        .collect::<Vec<_>>()
        .await
}

/// 批量任务中单个章节的生成逻辑（独立 async fn，避免内联闭包触发 HRTB 生命周期错误）。
async fn generate_one_scene(
    ctx: BatchCtx,
    chapter_num: u32,
    chapter_title: String,
    scene: Option<image::SceneDescription>,
) -> BatchChapterOutcome {
    let BatchCtx {
        app,
        dir,
        novel,
        config,
        prompts,
        statuses,
        meta_lock,
        total,
    } = ctx;

    let scene = match scene {
        Some(s) => s,
        None => return fail(&statuses, &app, total, chapter_num, "场景描述缺失"),
    };

    set_status(&statuses, chapter_num, "running", Some("准备中..."));
    emit_batch_progress(&app, &statuses, total, Some(chapter_num), Some("准备中...".into()));

    let prompt = image::build_scene_prompt(
        &prompts,
        &novel.title,
        chapter_num,
        &chapter_title,
        &scene.scene_desc,
        &scene.mood,
    );

    let statuses_cb = Arc::clone(&statuses);
    let app_cb = app.clone();
    let generated = match image::generate_image(&config, &prompt, move |msg| {
        set_status(&statuses_cb, chapter_num, "running", Some(msg));
        emit_batch_progress(&app_cb, &statuses_cb, total, Some(chapter_num), Some(msg.to_string()));
    })
    .await
    {
        Ok(g) => g,
        Err(e) => return fail(&statuses, &app, total, chapter_num, &e.to_string()),
    };

    // 元数据写：串行化，消除并发丢失更新。
    let id = image::generate_id();
    let local_path = match image::save_image_file(&dir, &image::ImageKind::Scene, &id, &generated.bytes)
    {
        Ok(p) => p,
        Err(e) => return fail(&statuses, &app, total, chapter_num, &e.to_string()),
    };

    let result = image::ImageResult {
        id: id.clone(),
        kind: image::ImageKind::Scene,
        prompt,
        revised_prompt: None,
        local_path,
        file_size: generated.bytes.len() as u64,
        created: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
        ref_id: Some(format!("ch{:03}", chapter_num)),
    };

    {
        let _guard = meta_lock.lock().unwrap();
        if let Err(e) = image::append_image_meta(&dir, &result) {
            return fail(&statuses, &app, total, chapter_num, &e.to_string());
        }
    }

    set_status(&statuses, chapter_num, "done", Some("完成"));
    emit_batch_progress(&app, &statuses, total, None, None);

    BatchChapterOutcome {
        chapter: chapter_num,
        result: Ok(result),
    }
}
