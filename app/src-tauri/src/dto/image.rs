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
    pub ref_text: Option<String>,
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
            ref_text: r.ref_id,
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
