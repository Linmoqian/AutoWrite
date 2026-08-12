use std::path::Path;

use crate::domain::config::AppConfig;
use crate::error::Result;

pub fn load_config(path: &Path) -> Result<AppConfig> {
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let content = std::fs::read_to_string(path)?;
    let config: AppConfig = serde_yaml::from_str(&content)?;
    Ok(config)
}

pub fn save_config(path: &Path, config: &AppConfig) -> Result<()> {
    let content = serde_yaml::to_string(config)?;
    // 原子写入（P0-4）：先写 .tmp 再 rename，带 .bak 备份。
    // 与 core::storage::write_file_atomic 一致，避免写入中途崩溃损坏配置。
    crate::storage::write_file_atomic(path, &content)
}
