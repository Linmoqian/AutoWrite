use serde::Serialize;

use crate::services::image::{ImageKind, ImageResult, SceneDescription};

/// IPC 视图：图片生成结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageResultDto {
    pub id: String,
    pub kind: ImageKind,
    pub prompt: String,
    pub revised_prompt: Option<String>,
    pub local_path: String,
    pub file_size: u64,
    pub created: String,
    pub ref_id: Option<String>,
}

impl From<ImageResult> for ImageResultDto {
    fn from(r: ImageResult) -> Self {
        Self {
            id: r.id,
            kind: r.kind,
            prompt: r.prompt,
            revised_prompt: r.revised_prompt,
            local_path: r.local_path,
            file_size: r.file_size,
            created: r.created,
            ref_id: r.ref_id,
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
