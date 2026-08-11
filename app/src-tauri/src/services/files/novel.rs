use std::path::Path;

use crate::domain::types::NovelData;
use crate::error::Result;
use super::{build_yaml_front_matter, next_h1_offset, novel_file, parse_yaml_front_matter, read_file_content, write_file_atomic};

pub fn write_novel(dir: &Path, data: &NovelData) -> Result<()> {
    let meta = serde_yaml::to_value(data)?;
    let mut body_parts = Vec::new();
    if let Some(world) = &data.world {
        body_parts.push(format!("# 世界观\n\n{}", world));
    }
    if let Some(characters) = &data.characters {
        body_parts.push(format!("# 角色\n\n{}", characters));
    }
    let content = format!(
        "{}\n{}",
        build_yaml_front_matter(&meta),
        body_parts.join("\n\n")
    );
    write_file_atomic(&novel_file(dir), &content)
}

pub fn read_novel(dir: &Path) -> Result<NovelData> {
    let content = read_file_content(&novel_file(dir))?;
    if content.is_empty() {
        return Err(crate::error::AppError::NovelNotFound(
            novel_file(dir).display().to_string(),
        ));
    }
    let (meta, body) = parse_yaml_front_matter(&content);
    let mut data: NovelData = serde_yaml::from_value(meta)?;
    if body.contains("# 世界观") {
        let after = body.split("# 世界观").nth(1).unwrap_or("");
        let end = next_h1_offset(after);
        let world = after[..end].trim().to_string();
        if !world.is_empty() {
            data.world = Some(world);
        }
    }
    if body.contains("# 角色") {
        let after = body.split("# 角色").nth(1).unwrap_or("");
        let end = next_h1_offset(after);
        let characters = after[..end].trim().to_string();
        if !characters.is_empty() {
            data.characters = Some(characters);
        }
    }
    Ok(data)
}
