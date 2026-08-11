use std::path::Path;

use super::{chapters_dir, parse_yaml_front_matter, read_file_content};
use crate::domain::types::ChapterMeta;
use crate::error::Result;

pub fn list_chapters(dir: &Path) -> Result<Vec<ChapterMeta>> {
    let ch_dir = chapters_dir(dir);
    if !ch_dir.exists() {
        return Ok(Vec::new());
    }
    let mut chapters: Vec<ChapterMeta> = Vec::new();
    for entry in std::fs::read_dir(&ch_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let content = read_file_content(&path)?;
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
    let content = read_file_content(&path)?;
    let (meta, body) = parse_yaml_front_matter(&content);
    let chapter_meta: ChapterMeta = serde_yaml::from_value(meta)?;
    Ok((chapter_meta, body))
}

pub fn list_chapters_with_content(dir: &Path) -> Result<Vec<(ChapterMeta, String)>> {
    let ch_dir = chapters_dir(dir);
    if !ch_dir.exists() {
        return Ok(Vec::new());
    }
    let mut chapters = Vec::new();
    for entry in std::fs::read_dir(&ch_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let content = read_file_content(&path)?;
            let (meta, body) = parse_yaml_front_matter(&content);
            if !meta.is_null() {
                if let Ok(ch) = serde_yaml::from_value::<ChapterMeta>(meta) {
                    chapters.push((ch, body));
                }
            }
        }
    }
    chapters.sort_by_key(|(c, _)| c.chapter);
    Ok(chapters)
}
