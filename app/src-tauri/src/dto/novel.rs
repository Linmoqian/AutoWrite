use std::collections::HashMap;

use serde::Serialize;

use crate::domain::novel::NovelStatus;
use crate::domain::types::{ChapterMeta, ContextData, NovelData, Volume};
use crate::state::OutlineGenerationStatus;

/// IPC 视图：小说整体状态。嵌入的领域类型保持其既有序列化（文件格式兼容），
/// 仅本结构体自身的多词字段应用 camelCase。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelStatusDto {
    pub novel: NovelData,
    pub context: ContextData,
    pub outline: Vec<Volume>,
    pub total_chapters: u32,
    pub written_chapters: u32,
}

impl From<NovelStatus> for NovelStatusDto {
    fn from(s: NovelStatus) -> Self {
        Self {
            novel: s.novel,
            context: s.context,
            outline: s.outline,
            total_chapters: s.total_chapters,
            written_chapters: s.written_chapters,
        }
    }
}

/// IPC 视图：章节元数据。字段为单词，camelCase 不改变序列化结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterMetaDto {
    pub chapter: u32,
    pub title: String,
    pub words: u32,
    pub created: String,
}

impl From<ChapterMeta> for ChapterMetaDto {
    fn from(m: ChapterMeta) -> Self {
        Self {
            chapter: m.chapter,
            title: m.title,
            words: m.words,
            created: m.created,
        }
    }
}

/// IPC 视图：章节正文（元数据 + 正文）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterContentDto {
    pub meta: ChapterMetaDto,
    pub body: String,
}

/// IPC 视图：后台大纲生成任务状态。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineGenerationStatusDto {
    pub running: bool,
    pub completed: bool,
    pub current_step: Option<String>,
    pub streaming_text: HashMap<String, String>,
    pub error: Option<String>,
}

impl From<OutlineGenerationStatus> for OutlineGenerationStatusDto {
    fn from(s: OutlineGenerationStatus) -> Self {
        Self {
            running: s.running,
            completed: s.completed,
            current_step: s.current_step,
            streaming_text: s.streaming_text,
            error: s.error,
        }
    }
}
