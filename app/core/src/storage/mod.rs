use std::fs;
use std::path::{Path, PathBuf};

use crate::error::Result;

pub mod chapters;
pub mod context;
pub mod novel;
pub mod outline;

pub use chapters::{list_chapters, list_chapters_with_content, read_chapter};
pub use context::{read_context, write_context};
pub use novel::{read_novel, write_novel};
pub use outline::{get_chapter_outline, parse_outline_text, read_outline, write_outline};

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

pub(crate) fn read_file_content(path: &Path) -> Result<String> {
    read_file(path)
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

pub fn parse_yaml_front_matter(content: &str) -> (serde_yaml::Value, String) {
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

pub(crate) fn build_yaml_front_matter(data: &serde_yaml::Value) -> String {
    format!(
        "---\n{}---\n",
        serde_yaml::to_string(data).unwrap_or_default()
    )
}

/// Finds the byte offset of the next top-level Markdown heading (`# ` but not `## `).
pub(crate) fn next_h1_offset(text: &str) -> usize {
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\n' && i + 2 < bytes.len() && bytes[i + 1] == b'#' && bytes[i + 2] == b' '
        {
            return i;
        }
        i += 1;
    }
    text.len()
}
