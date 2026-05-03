use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};

// 数据类型

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NovelData {
    pub title: String,
    pub genre: String,
    pub theme: String,
    pub target_chapters: u32,
    pub words_per_chapter: u32,
    pub model: String,
    pub created: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub world: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub characters: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Volume {
    pub volume: String,
    pub chapters: Vec<ChapterEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterEntry {
    pub num: u32,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionalTag {
    pub tag: String,
    pub intensity: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TensionItem {
    pub item: String,
    #[serde(default = "default_open")]
    pub status: String,
}

fn default_open() -> String {
    "open".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeIntent {
    pub character_wants: String,
    pub obstacle: String,
    pub reader_should_care: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextData {
    pub current_chapter: u32,
    #[serde(default)]
    pub recent_summaries: Vec<String>,
    #[serde(default)]
    pub character_states: Vec<serde_yaml::Value>,
    #[serde(default)]
    pub pending_plots: Vec<String>,
    #[serde(default)]
    pub plot_events: Vec<String>,
    #[serde(default)]
    pub unresolved_threads: Vec<String>,
    #[serde(default)]
    pub emotional_arc: Vec<EmotionalTag>,
    #[serde(default)]
    pub tension_checklist: Vec<TensionItem>,
    #[serde(default)]
    pub current_intent: Option<NarrativeIntent>,
}

impl Default for ContextData {
    fn default() -> Self {
        Self {
            current_chapter: 0,
            recent_summaries: Vec::new(),
            character_states: Vec::new(),
            pending_plots: Vec::new(),
            plot_events: Vec::new(),
            unresolved_threads: Vec::new(),
            emotional_arc: Vec::new(),
            tension_checklist: Vec::new(),
            current_intent: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterMeta {
    pub chapter: u32,
    pub title: String,
    pub words: u32,
    pub created: String,
}

// 路径辅助

pub fn novel_file(dir: &Path) -> PathBuf {
    dir.join("novel.md")
}
pub fn outline_file(dir: &Path) -> PathBuf {
    dir.join("outline.md")
}
pub fn context_file(dir: &Path) -> PathBuf {
    dir.join("context.md")
}
pub fn chapters_dir(dir: &Path) -> PathBuf {
    dir.join("chapters")
}

// 通用文件操作

fn normalize_newlines(content: &str) -> String {
    content.replace("\r\n", "\n")
}

fn read_file(path: &Path) -> Result<String> {
    if !path.exists() {
        return Ok(String::new());
    }
    let content = fs::read_to_string(path)?;
    Ok(normalize_newlines(&content))
}

pub fn write_file_atomic(path: &Path, content: &str) -> Result<()> {
    if path.exists() {
        let bak = PathBuf::from(format!("{}.bak", path.display()));
        let _ = fs::copy(path, bak);
    }
    let tmp = PathBuf::from(format!("{}.tmp", path.display()));
    fs::write(&tmp, content)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

// YAML front matter

fn parse_yaml_front_matter(content: &str) -> (serde_yaml::Value, String) {
    if !content.starts_with("---\n") {
        return (serde_yaml::Value::Null, content.to_string());
    }
    let parts: Vec<&str> = content.splitn(3, "---\n").collect();
    if parts.len() < 3 {
        return (serde_yaml::Value::Null, content.to_string());
    }
    let meta: serde_yaml::Value = serde_yaml::from_str(parts[1]).unwrap_or(serde_yaml::Value::Null);
    (meta, parts[2].trim().to_string())
}

fn build_yaml_front_matter(data: &serde_yaml::Value) -> String {
    format!(
        "---\n{}---\n",
        serde_yaml::to_string(data).unwrap_or_default()
    )
}

// novel.md 操作

pub fn write_novel(dir: &Path, data: &NovelData) -> Result<()> {
    let meta = serde_yaml::to_value(data)?;
    let mut body_parts = Vec::new();
    if let Some(world) = &data.world {
        body_parts.push(format!("# 世界观\n\n{}", world));
    }
    if let Some(characters) = &data.characters {
        body_parts.push(format!("# 角色\n\n{}", characters));
    }
    let content = format!("{}\n{}", build_yaml_front_matter(&meta), body_parts.join("\n\n"));
    write_file_atomic(&novel_file(dir), &content)
}

pub fn read_novel(dir: &Path) -> Result<NovelData> {
    let content = read_file(&novel_file(dir))?;
    if content.is_empty() {
        return Err(AppError::NovelNotFound(novel_file(dir).display().to_string()));
    }
    let (meta, body) = parse_yaml_front_matter(&content);
    let mut data: NovelData = serde_yaml::from_value(meta)?;
    if body.contains("# 世界观") {
        let world_section = body.split("# 世界观").nth(1).unwrap_or("");
        let world = world_section
            .split("\n# ")
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        if !world.is_empty() {
            data.world = Some(world);
        }
    }
    if body.contains("# 角色") {
        let char_section = body.split("# 角色").nth(1).unwrap_or("");
        let characters = char_section
            .split("\n# ")
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        if !characters.is_empty() {
            data.characters = Some(characters);
        }
    }
    Ok(data)
}

// outline.md 操作

pub fn write_outline(dir: &Path, outline: &[Volume]) -> Result<()> {
    let mut lines = vec!["# 大纲\n".to_string()];
    for volume in outline {
        lines.push(format!("## {}\n", volume.volume));
        for ch in &volume.chapters {
            lines.push(format!("- {:03}. {}", ch.num, ch.title));
        }
        lines.push(String::new());
    }
    write_file_atomic(&outline_file(dir), &lines.join("\n"))
}

pub fn read_outline(dir: &Path) -> Result<Vec<Volume>> {
    let content = read_file(&outline_file(dir))?;
    if content.is_empty() {
        return Ok(Vec::new());
    }
    parse_outline_text(&content)
}

pub fn get_chapter_outline(dir: &Path, chapter_num: u32) -> Result<Option<String>> {
    let outline = read_outline(dir)?;
    for volume in &outline {
        for ch in &volume.chapters {
            if ch.num == chapter_num {
                return Ok(Some(ch.title.clone()));
            }
        }
    }
    Ok(None)
}

pub fn parse_outline_text(text: &str) -> Result<Vec<Volume>> {
    let mut outline: Vec<Volume> = Vec::new();
    let mut current_volume: Option<Volume> = None;

    for line in text.lines() {
        let line = line.trim();
        if line.starts_with("## ") {
            if let Some(vol) = current_volume.take() {
                outline.push(vol);
            }
            current_volume = Some(Volume {
                volume: line[3..].to_string(),
                chapters: Vec::new(),
            });
        } else if line.starts_with("- ") || line.starts_with("* ") {
            if let Some(ref mut vol) = current_volume {
                let rest = &line[2..];
                if let Some(dot_pos) = rest.find(". ") {
                    if let Ok(num) = rest[..dot_pos].trim().parse::<u32>() {
                        vol.chapters.push(ChapterEntry {
                            num,
                            title: rest[dot_pos + 2..].trim().to_string(),
                        });
                    }
                }
            }
        } else {
            // 格式：数字. 标题 (如 "1. 混沌海遗珠——...")
            if let Some(ref mut vol) = current_volume {
                if let Some(rest) = line.strip_prefix(|c: char| c.is_ascii_digit()) {
                    // 跳过多位数字
                    let rest = rest.trim_start_matches(|c: char| c.is_ascii_digit());
                    if let Some(rest) = rest.strip_prefix('.') {
                        let rest = rest.trim_start();
                        if !rest.is_empty() {
                            // 尝试从行首解析序号
                            let num_start = line.find(|c: char| !c.is_ascii_digit()).unwrap_or(0);
                            if let Ok(num) = line[..num_start].parse::<u32>() {
                                vol.chapters.push(ChapterEntry {
                                    num,
                                    title: rest.to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    if let Some(vol) = current_volume.take() {
        outline.push(vol);
    }
    Ok(outline)
}

// context.md 操作

pub fn write_context(dir: &Path, ctx: &ContextData) -> Result<()> {
    let mut lines = vec![
        format!("# 上下文摘要\n\n## 当前进度\n- 已完成：{}章\n", ctx.current_chapter),
    ];
    // 叙事意图
    if let Some(ref intent) = ctx.current_intent {
        lines.push("## 叙事意图".to_string());
        lines.push(format!("- 角色想要：{}", intent.character_wants));
        lines.push(format!("- 阻碍：{}", intent.obstacle));
        lines.push(format!("- 读者关注：{}", intent.reader_should_care));
        lines.push(String::new());
    }
    // 角色状态
    if !ctx.character_states.is_empty() {
        lines.push("## 角色状态".to_string());
        for s in &ctx.character_states {
            if let Some(name) = s.get("name").and_then(|v| v.as_str()) {
                let location = s.get("location").and_then(|v| v.as_str()).unwrap_or("?");
                let power = s.get("power_level").and_then(|v| v.as_str()).unwrap_or("?");
                let action = s.get("recent_action").and_then(|v| v.as_str()).unwrap_or("?");
                lines.push(format!("- {}：{}，{}，{}", name, location, power, action));
            }
        }
        lines.push(String::new());
    }
    // 关键事件
    if !ctx.plot_events.is_empty() {
        lines.push("## 关键事件".to_string());
        for e in ctx.plot_events.iter().rev().take(10) {
            lines.push(format!("- {}", e));
        }
        lines.push(String::new());
    }
    // 张力清单
    if !ctx.tension_checklist.is_empty() {
        lines.push("## 张力清单".to_string());
        for t in ctx.tension_checklist.iter().rev().take(10) {
            let mark = if t.status == "resolved" { "x" } else { " " };
            lines.push(format!("- [{}] {}", mark, t.item));
        }
        lines.push(String::new());
    }
    // 情感弧线
    if !ctx.emotional_arc.is_empty() {
        lines.push("## 情感弧线".to_string());
        for e in ctx.emotional_arc.iter().rev().take(8) {
            lines.push(format!("- {}({})", e.tag, e.intensity));
        }
        lines.push(String::new());
    }
    write_file_atomic(&context_file(dir), &lines.join("\n"))
}

pub fn read_context(dir: &Path) -> Result<ContextData> {
    let content = read_file(&context_file(dir))?;
    let mut result = ContextData::default();
    if content.is_empty() {
        return Ok(result);
    }
    let mut section: Option<&str> = None;
    for line in content.lines() {
        match line.trim() {
            s if s.starts_with("## 当前进度") => section = Some("progress"),
            s if s.starts_with("## 剧情摘要") => section = Some("summaries"),
            s if s.starts_with("## 角色状态") => section = Some("characters"),
            s if s.starts_with("## 待埋伏笔") => section = Some("plots"),
            s if s.starts_with("## 叙事意图") => section = Some("intent"),
            s if s.starts_with("## 关键事件") => section = Some("events"),
            s if s.starts_with("## 未解决悬念") => section = Some("threads"),
            s if s.starts_with("## 张力清单") => section = Some("tension"),
            s if s.starts_with("## 情感弧线") => section = Some("emotion"),
            s if !s.is_empty() => match section {
                Some("progress") if s.contains("已完成：") => {
                    if let Some(idx) = s.find("已完成：") {
                        let num_str = s[idx + "已完成：".len()..].replace("章", "");
                        if let Ok(n) = num_str.trim().parse::<u32>() {
                            result.current_chapter = n;
                        }
                    }
                }
                Some("summaries") if !s.starts_with("#") => {
                    result.recent_summaries.push(s.to_string());
                }
                Some("characters") if s.starts_with("- ") => {
                    result.character_states.push(serde_yaml::Value::String(s[2..].to_string()));
                }
                Some("plots") if s.starts_with("- ") => {
                    result.pending_plots.push(s[2..].to_string());
                }
                Some("intent") if s.starts_with("- ") => {
                    let text = &s[2..];
                    if result.current_intent.is_none() {
                        result.current_intent = Some(NarrativeIntent {
                            character_wants: String::new(),
                            obstacle: String::new(),
                            reader_should_care: String::new(),
                        });
                    }
                    if let Some(ref mut intent) = result.current_intent {
                        if text.starts_with("角色想要：") {
                            intent.character_wants = text["角色想要：".len()..].to_string();
                        } else if text.starts_with("阻碍：") {
                            intent.obstacle = text["阻碍：".len()..].to_string();
                        } else if text.starts_with("读者关注：") {
                            intent.reader_should_care = text["读者关注：".len()..].to_string();
                        }
                    }
                }
                Some("events") if s.starts_with("- ") => {
                    result.plot_events.push(s[2..].to_string());
                }
                Some("threads") if s.starts_with("- [ ] ") => {
                    result.unresolved_threads.push(s[6..].to_string());
                }
                Some("tension") if s.starts_with("- [") => {
                    let mark = s.chars().nth(3).unwrap_or(' ');
                    let item = s.get(6..).unwrap_or("").to_string();
                    result.tension_checklist.push(TensionItem {
                        item,
                        status: if mark == 'x' { "resolved".to_string() } else { "open".to_string() },
                    });
                }
                Some("emotion") if s.starts_with("- ") => {
                    let text = &s[2..];
                    if let Some(pos) = text.rfind('(') {
                        let tag = text[..pos].to_string();
                        let intensity_str = text[pos + 1..].trim_end_matches(')');
                        if let Ok(intensity) = intensity_str.parse::<u32>() {
                            result.emotional_arc.push(EmotionalTag { tag, intensity });
                        }
                    }
                }
                _ => {}
            },
            _ => {}
        }
    }
    Ok(result)
}

// 章节文件操作

pub fn list_chapters(dir: &Path) -> Result<Vec<ChapterMeta>> {
    let ch_dir = chapters_dir(dir);
    if !ch_dir.exists() {
        return Ok(Vec::new());
    }
    let mut chapters: Vec<ChapterMeta> = Vec::new();
    for entry in fs::read_dir(&ch_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let content = read_file(&path)?;
            let (meta, _) = parse_yaml_front_matter(&content);
            if !meta.is_null() {
                if let Ok(ch) = serde_yaml::from_value::<ChapterMeta>(meta) {
                    chapters.push(ch);
                }
            }
        }
    }
    chapters.sort_by_key(|c| c.chapter);
    Ok(chapters)
}

pub fn read_chapter(dir: &Path, filename: &str) -> Result<(ChapterMeta, String)> {
    let path = chapters_dir(dir).join(filename);
    let content = read_file(&path)?;
    let (meta, body) = parse_yaml_front_matter(&content);
    let chapter_meta: ChapterMeta = serde_yaml::from_value(meta)?;
    Ok((chapter_meta, body))
}
