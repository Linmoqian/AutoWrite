//! 小说相关 DTO 层（ADR-008）。
//!
//! 领域类型（`NovelData`/`ContextData`/`Volume`/`ChapterMeta`）保持磁盘文件
//! 兼容不动，所有字段重命名、形状转换在本模块的 `From` impl 中完成，
//! 输出严格对齐前端 SPEC 6.3（`src/types/index.ts`）。

use std::collections::HashMap;

use serde::Serialize;

use crate::domain::novel::NovelStatus;
use crate::domain::types::{
    ChapterEntry, ChapterMeta, ContextData, NovelData, Volume,
};
use crate::domain::util::map_step;
use crate::state::OutlineGenerationStatus;

/// IPC 视图：小说元数据。独立结构（不嵌入领域 `NovelData`），
/// 做字段重命名与 `Option` 解包。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelDataDto {
    pub title: String,
    pub genre: String,
    pub theme: String,
    pub target_chapters: u32,
    pub world_view: String,
    pub characters: String,
    pub created_at: String,
}

impl From<NovelData> for NovelDataDto {
    fn from(d: NovelData) -> Self {
        Self {
            title: d.title,
            genre: d.genre,
            theme: d.theme,
            target_chapters: d.target_chapters,
            world_view: d.world.unwrap_or_default(),
            characters: d.characters.unwrap_or_default(),
            created_at: d.created,
        }
    }
}

/// IPC 视图：章节元数据。
///
/// 注意：领域 `ChapterMeta` 没有 `filename`（磁盘文件名由落盘时的
/// `{NNN}-{safe_title}.md` 约定生成，不在 front-matter 中持久化），
/// 故无法用 `From<ChapterMeta>` 自动推导，改用 `from_meta` 工厂方法，
/// 由命令层注入真实文件名。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterMetaDto {
    pub filename: String,
    pub number: u32,
    pub title: String,
    pub word_count: u32,
    pub created_at: String,
}

impl ChapterMetaDto {
    /// 由领域元数据 + 磁盘文件名构造 DTO。
    pub fn from_meta(meta: ChapterMeta, filename: impl Into<String>) -> Self {
        Self {
            filename: filename.into(),
            number: meta.chapter,
            title: meta.title,
            word_count: meta.words,
            created_at: meta.created,
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

impl ChapterContentDto {
    /// 由领域元数据 + 磁盘文件名 + 正文构造 DTO。
    pub fn from_parts(meta: ChapterMeta, filename: impl Into<String>, body: String) -> Self {
        Self {
            meta: ChapterMetaDto::from_meta(meta, filename),
            body,
        }
    }
}

/// IPC 视图：叙事记忆。领域各子结构形状不同，在此对齐前端宽类型契约。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextDataDto {
    /// 领域存 `Vec<serde_yaml::Value>`（运行时 AI 生成），透传为 JSON，
    /// 前端按 `CharacterState` 宽松解析。
    pub character_states: Vec<serde_json::Value>,
    pub plot_events: Vec<PlotEventDto>,
    pub unresolved_threads: Vec<TensionItemDto>,
    pub emotional_arc: Vec<EmotionalTagDto>,
    pub current_intent: NarrativeIntentDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlotEventDto {
    pub chapter: u32,
    pub event: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TensionItemDto {
    pub item: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmotionalTagDto {
    pub chapter: u32,
    pub tag: String,
    pub intensity: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NarrativeIntentDto {
    pub character_wants: String,
    pub obstacle: String,
    pub reader_should_care: String,
}

impl From<ContextData> for ContextDataDto {
    fn from(c: ContextData) -> Self {
        // chapter 字段领域未逐条记录，用当前章节号填充（前端 Dashboard 展示用）。
        let chapter = c.current_chapter.max(1);

        let character_states = c
            .character_states
            .into_iter()
            .map(|v| yaml_value_to_json(v).unwrap_or(serde_json::Value::Null))
            .collect();

        let plot_events = c
            .plot_events
            .into_iter()
            .map(|e| PlotEventDto {
                chapter,
                event: e,
            })
            .collect();

        // 合并 tension_checklist（已有 status）与 unresolved_threads（裸字符串，
        // 视为 open），前端 `unresolvedThreads: TensionItem[]`。
        let mut unresolved_threads: Vec<TensionItemDto> = c
            .tension_checklist
            .into_iter()
            .map(|t| TensionItemDto {
                item: t.item,
                status: t.status,
            })
            .collect();
        unresolved_threads.extend(c.unresolved_threads.into_iter().map(|item| TensionItemDto {
            item,
            status: "open".to_string(),
        }));

        let emotional_arc = c
            .emotional_arc
            .into_iter()
            .map(|e| EmotionalTagDto {
                chapter,
                tag: e.tag,
                intensity: e.intensity,
            })
            .collect();

        let current_intent = match c.current_intent {
            Some(i) => NarrativeIntentDto {
                character_wants: i.character_wants,
                obstacle: i.obstacle,
                reader_should_care: i.reader_should_care,
            },
            // 前端类型非可选，缺省时填空串。
            None => NarrativeIntentDto {
                character_wants: String::new(),
                obstacle: String::new(),
                reader_should_care: String::new(),
            },
        };

        Self {
            character_states,
            plot_events,
            unresolved_threads,
            emotional_arc,
            current_intent,
        }
    }
}

/// 将 `serde_yaml::Value` 转为 `serde_json::Value`（格式无关的结构透传）。
fn yaml_value_to_json(v: serde_yaml::Value) -> serde_json::Result<serde_json::Value> {
    serde_json::to_value(&v)
}

/// IPC 视图：卷。领域 `Volume.volume → title`。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeDto {
    pub title: String,
    pub chapters: Vec<ChapterEntryDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterEntryDto {
    pub number: u32,
    pub title: String,
    /// 前端类型要求该字段但当前不依赖具体内容，占位空串。
    pub summary: String,
}

impl From<Volume> for VolumeDto {
    fn from(v: Volume) -> Self {
        Self {
            title: v.volume,
            chapters: v.chapters.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<ChapterEntry> for ChapterEntryDto {
    fn from(e: ChapterEntry) -> Self {
        Self {
            number: e.num,
            title: e.title,
            summary: String::new(),
        }
    }
}

/// IPC 视图：小说整体状态。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelStatusDto {
    pub novel: NovelDataDto,
    pub context: ContextDataDto,
    pub outline: Vec<VolumeDto>,
    pub total_chapters: u32,
    pub written_chapters: u32,
}

impl From<NovelStatus> for NovelStatusDto {
    fn from(s: NovelStatus) -> Self {
        Self {
            novel: s.novel.into(),
            context: s.context.into(),
            outline: s.outline.into_iter().map(Into::into).collect(),
            total_chapters: s.total_chapters,
            written_chapters: s.written_chapters,
        }
    }
}

/// IPC 视图：后台大纲生成任务状态。步骤名经 `map_step` 转换为前端契约值。
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
        let current_step = s.current_step.map(|step| map_step(&step).to_string());
        let streaming_text = s
            .streaming_text
            .into_iter()
            .map(|(k, v)| (map_step(&k).to_string(), v))
            .collect();
        Self {
            running: s.running,
            completed: s.completed,
            current_step,
            streaming_text,
            error: s.error,
        }
    }
}
