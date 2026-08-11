use std::path::Path;

use super::{outline_file, read_file_content, write_file_atomic};
use crate::domain::types::{ChapterEntry, Volume};
use crate::error::Result;

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
    let content = read_file_content(&outline_file(dir))?;
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
                volume: line.strip_prefix("## ").unwrap_or(line).to_string(),
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
            // Format: number. title
            if let Some(ref mut vol) = current_volume {
                if let Some(rest) = line.strip_prefix(|c: char| c.is_ascii_digit()) {
                    let rest = rest.trim_start_matches(|c: char| c.is_ascii_digit());
                    if let Some(rest) = rest.strip_prefix('.') {
                        let rest = rest.trim_start();
                        if !rest.is_empty() {
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
