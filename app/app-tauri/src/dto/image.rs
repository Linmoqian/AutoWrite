use std::path::Path;

use serde::Serialize;

use crate::services::image::{ImageKind, ImageResult, SceneDescription};

/// IPC 视图：图片生成结果。对齐前端 `ImageResult`（SPEC 6.3）。
///
/// - `filename`：领域 `local_path`（全路径）取 basename。
/// - `ref_text`：领域 `ref_id`。
/// - `created_at`：领域 `created`。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageResultDto {
    pub id: String,
    pub kind: ImageKind,
    pub prompt: String,
    pub filename: String,
    pub ref_text: String,
    pub created_at: String,
}

impl From<ImageResult> for ImageResultDto {
    fn from(r: ImageResult) -> Self {
        let filename = Path::new(&r.local_path)
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
            .unwrap_or(r.local_path);
        Self {
            id: r.id,
            kind: r.kind,
            prompt: r.prompt,
            filename,
            // SPEC 6.3 / 前端 `ImageResult.refText` 为必填 string；领域 `ref_id` 为
            // Option，这里兜底空串以对齐契约（封面/角色/场景实际均带 ref）。
            ref_text: r.ref_id.unwrap_or_default(),
            created_at: r.created,
        }
    }
}

/// IPC 视图：AI 提取的场景描述（场景文本 + 氛围关键词）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneDescriptionDto {
    pub scene_desc: String,
    pub mood: String,
}

impl From<SceneDescription> for SceneDescriptionDto {
    fn from(s: SceneDescription) -> Self {
        Self {
            scene_desc: s.scene_desc,
            mood: s.mood,
        }
    }
}

/// IPC 事件载荷：图片生成进度。通过 `image-progress` 事件推送到前端。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageProgressEvent {
    pub stage: String,
    pub message: String,
    pub image_id: Option<String>,
}

/// IPC 事件载荷：批量场景插图整体进度。通过 `batch-image-progress` 事件推送到前端。
/// 用于批量生成时驱动整体进度条与每章状态卡片。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImageProgress {
    /// 本次批量任务的总章节数。
    pub total: u32,
    /// 已成功完成的数量。
    pub completed: u32,
    /// 已失败的数量。
    pub failed: u32,
    /// 当前正在生成的章节号（同时进行的多章中取其一即可，前端据此标记「生成中」）。
    pub current_chapter: Option<u32>,
    /// 当前章节的进度阶段文本。
    pub current_message: Option<String>,
    /// 每章的实时状态快照（全量，前端直接渲染，无需推导）。
    pub chapters: Vec<BatchChapterStatus>,
}

/// 批量任务中单个章节的状态快照。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchChapterStatus {
    pub chapter: u32,
    /// pending | running | done | failed
    pub status: String,
    /// 人类可读的阶段/失败信息。
    pub message: Option<String>,
}
