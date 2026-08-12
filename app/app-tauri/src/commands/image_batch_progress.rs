//! 批量场景插图的进度推送与状态管理辅助函数。

use std::sync::Arc;

use tauri::Emitter;

use crate::dto::{BatchChapterStatus, BatchImageProgress};

/// 标记某章失败并返回失败结果（消除重复的错误处理样板）。
pub fn fail(
    statuses: &Arc<std::sync::Mutex<Vec<BatchChapterStatus>>>,
    app: &tauri::AppHandle,
    total: u32,
    chapter_num: u32,
    msg: &str,
) -> super::image_batch::BatchChapterOutcome {
    set_status(statuses, chapter_num, "failed", Some(msg));
    emit_batch_progress(app, statuses, total, None, None);
    super::image_batch::BatchChapterOutcome {
        chapter: chapter_num,
        result: Err(msg.to_string()),
    }
}

/// 推送批量整体进度事件。从共享状态快照重算 completed/failed。
pub fn emit_batch_progress(
    app: &tauri::AppHandle,
    statuses: &std::sync::Mutex<Vec<BatchChapterStatus>>,
    total: u32,
    current_chapter: Option<u32>,
    current_message: Option<String>,
) {
    let snapshot = statuses.lock().unwrap().clone();
    let completed = snapshot.iter().filter(|s| s.status == "done").count() as u32;
    let failed = snapshot.iter().filter(|s| s.status == "failed").count() as u32;
    let _ = app.emit(
        "batch-image-progress",
        BatchImageProgress {
            total,
            completed,
            failed,
            current_chapter,
            current_message,
            chapters: snapshot,
        },
    );
}

/// 更新某章在共享状态快照中的状态。
pub fn set_status(
    statuses: &std::sync::Mutex<Vec<BatchChapterStatus>>,
    chapter: u32,
    status: &str,
    message: Option<&str>,
) {
    if let Some(s) = statuses
        .lock()
        .unwrap()
        .iter_mut()
        .find(|s| s.chapter == chapter)
    {
        s.status = status.to_string();
        s.message = message.map(|m| m.to_string());
    }
}
