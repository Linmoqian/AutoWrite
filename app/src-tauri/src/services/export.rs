use std::path::Path;

use crate::domain::types::{NovelData, Volume};
use crate::error::Result;
use crate::services::files;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportChapter {
    pub num: u32,
    pub title: String,
    pub words: u32,
    pub body: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportData {
    pub novel: NovelData,
    pub outline: Vec<Volume>,
    pub chapters: Vec<ExportChapter>,
}

pub fn collect_export_data(dir: &Path) -> Result<ExportData> {
    let novel = files::read_novel(dir)?;
    let outline = files::read_outline(dir)?;
    let raw_chapters = files::list_chapters_with_content(dir)?;

    let chapters = raw_chapters
        .into_iter()
        .map(|(meta, body)| ExportChapter {
            num: meta.chapter,
            title: meta.title,
            words: meta.words,
            body,
        })
        .collect();

    Ok(ExportData {
        novel,
        outline,
        chapters,
    })
}

pub fn render_markdown(data: &ExportData) -> String {
    let mut parts = Vec::new();

    parts.push(format!("# {}\n", data.novel.title));
    parts.push(format!(
        "> {} | {} | {}章\n",
        data.novel.genre, data.novel.theme, data.novel.target_chapters
    ));
    parts.push(format!("> 创建日期：{}\n", data.novel.created));

    if let Some(world) = &data.novel.world {
        parts.push(String::new());
        parts.push("## 世界观\n".to_string());
        parts.push(world.clone());
    }

    if let Some(characters) = &data.novel.characters {
        parts.push(String::new());
        parts.push("## 角色\n".to_string());
        parts.push(characters.clone());
    }

    if !data.outline.is_empty() {
        parts.push(String::new());
        parts.push("---\n".to_string());
        parts.push("## 目录\n".to_string());
        for volume in &data.outline {
            parts.push(format!("### {}\n", volume.volume));
            for ch in &volume.chapters {
                parts.push(format!("- {:03}. {}", ch.num, ch.title));
            }
            parts.push(String::new());
        }
    }

    for chapter in &data.chapters {
        parts.push(String::new());
        parts.push("---\n".to_string());
        parts.push(format!("# 第{}章 {}\n", chapter.num, chapter.title));
        parts.push(chapter.body.clone());
    }

    parts.join("\n")
}

pub fn render_plain_text(data: &ExportData) -> String {
    let md = render_markdown(data);
    strip_markdown(&md)
}

fn strip_markdown(text: &str) -> String {
    let mut result = String::new();
    for line in text.lines() {
        let trimmed = line.trim();
        let processed = if trimmed == "---" {
            String::new()
        } else if trimmed.starts_with("# ") {
            format!("\n{}\n", strip_formatting(&trimmed[2..]))
        } else if trimmed.starts_with("## ") {
            format!("\n{}\n", strip_formatting(&trimmed[3..]))
        } else if trimmed.starts_with("### ") {
            format!("\n{}\n", strip_formatting(&trimmed[4..]))
        } else if trimmed.starts_with("> ") {
            format!("  {}", strip_formatting(&trimmed[2..]))
        } else if trimmed.starts_with("- ") {
            format!("  · {}", strip_formatting(&trimmed[2..]))
        } else if trimmed.starts_with("* ") {
            format!("  · {}", strip_formatting(&trimmed[2..]))
        } else {
            strip_formatting(trimmed).to_string()
        };
        result.push_str(&processed);
        result.push('\n');
    }
    while result.contains("\n\n\n") {
        result = result.replace("\n\n\n", "\n\n");
    }
    result.trim().to_string() + "\n"
}

fn strip_formatting(text: &str) -> String {
    let s = text.to_string();
    let s = strip_pairs(&s, "**");
    let s = strip_pairs(&s, "`");
    strip_single_asterisk(&s)
}

fn strip_pairs(text: &str, delim: &str) -> String {
    let mut result = String::new();
    let chars: Vec<char> = text.chars().collect();
    let delim_chars: Vec<char> = delim.chars().collect();
    let dlen = delim_chars.len();
    let mut i = 0;
    while i < chars.len() {
        if i + dlen <= chars.len() && chars[i..i + dlen] == delim_chars[..] {
            let start = i + dlen;
            let mut end = start;
            while end + dlen <= chars.len() {
                if chars[end..end + dlen] == delim_chars[..] {
                    break;
                }
                end += 1;
            }
            if end + dlen <= chars.len() {
                for &c in &chars[start..end] {
                    result.push(c);
                }
                i = end + dlen;
            } else {
                result.push(chars[i]);
                i += 1;
            }
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }
    result
}

fn strip_single_asterisk(text: &str) -> String {
    let mut result = String::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '*' && (i == 0 || chars[i - 1] != '*') {
            let start = i + 1;
            let mut end = start;
            while end < chars.len() {
                if chars[end] == '*' && (end + 1 >= chars.len() || chars[end + 1] != '*') {
                    break;
                }
                end += 1;
            }
            if end < chars.len() {
                for &c in &chars[start..end] {
                    result.push(c);
                }
                i = end + 1;
            } else {
                result.push(chars[i]);
                i += 1;
            }
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }
    result
}

pub fn total_words(data: &ExportData) -> u32 {
    data.chapters.iter().map(|c| c.words).sum()
}
