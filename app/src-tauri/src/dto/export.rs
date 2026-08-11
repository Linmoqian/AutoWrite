use serde::Serialize;

use crate::domain::types::{NovelData, Volume};
use crate::services::export::{ExportChapter, ExportData};

/// IPC 视图：导出章节（序号、标题、字数、正文）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportChapterDto {
    pub num: u32,
    pub title: String,
    pub words: u32,
    pub body: String,
}

impl From<ExportChapter> for ExportChapterDto {
    fn from(c: ExportChapter) -> Self {
        Self {
            num: c.num,
            title: c.title,
            words: c.words,
            body: c.body,
        }
    }
}

/// IPC 视图：导出数据汇总（小说元数据 + 大纲 + 章节列表）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDataDto {
    pub novel: NovelData,
    pub outline: Vec<Volume>,
    pub chapters: Vec<ExportChapterDto>,
}

impl From<ExportData> for ExportDataDto {
    fn from(d: ExportData) -> Self {
        Self {
            novel: d.novel,
            outline: d.outline,
            chapters: d.chapters.into_iter().map(Into::into).collect(),
        }
    }
}
