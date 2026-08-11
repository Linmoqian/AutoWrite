use std::fs;
use std::path::PathBuf;

use autowrite_core::AppConfig;

/// 配置文件路径：~/.config/autowrite/config.yaml（与桌面 app 一致）
pub fn config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("autowrite").join("config.yaml"))
}

/// 加载配置；文件不存在返回默认值
pub fn load_config() -> AppConfig {
    match config_path() {
        Some(path) if path.exists() => {
            let text = fs::read_to_string(&path).unwrap_or_default();
            if text.is_empty() {
                AppConfig::default()
            } else {
                serde_yaml::from_str(&text).unwrap_or_else(|_| AppConfig::default())
            }
        }
        _ => AppConfig::default(),
    }
}

/// 保存配置到 ~/.config/autowrite/config.yaml
pub fn save_config(config: &AppConfig) -> Result<(), Box<dyn std::error::Error>> {
    let path = config_path().ok_or("无法定位配置目录")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let yaml = serde_yaml::to_string(config)?;
    fs::write(&path, yaml)?;
    Ok(())
}
