use serde::Serialize;

use crate::dto::novel::{NovelDataDto, VolumeDto};
use crate::services::export::{ExportChapter, ExportData};

/// IPC 视图：导出章节（序号、标题、字数、正文）。对齐前端 `ExportChapter`（SPEC 6.3）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportChapterDto {
    pub number: u32,
    pub title: String,
    pub word_count: u32,
    pub body: String,
}

impl From<ExportChapter> for ExportChapterDto {
    fn from(c: ExportChapter) -> Self {
        Self {
            number: c.num,
            title: c.title,
            word_count: c.words,
            body: c.body,
        }
    }
}

/// IPC 视图：导出数据汇总（小说元数据 + 大纲 + 章节列表）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDataDto {
    pub novel: NovelDataDto,
    pub outline: Vec<VolumeDto>,
    pub chapters: Vec<ExportChapterDto>,
}

impl From<ExportData> for ExportDataDto {
    fn from(d: ExportData) -> Self {
        Self {
            novel: d.novel.into(),
            outline: d.outline.into_iter().map(Into::into).collect(),
            chapters: d.chapters.into_iter().map(Into::into).collect(),
        }
    }
}
