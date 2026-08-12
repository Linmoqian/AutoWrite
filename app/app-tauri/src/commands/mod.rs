pub mod config;
pub mod export;
pub mod image;
pub mod image_batch;
pub mod image_batch_progress;
pub mod novel;
pub mod system;

use std::path::{Component, Path, PathBuf};

use tauri::State;

use crate::domain::config::AppConfig;
use crate::error::{AppError, Result};
use crate::state::AppState;

pub(crate) fn dir_from_state(state: &State<AppState>) -> Result<PathBuf> {
    state
        .novel_dir
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .ok_or(AppError::NoNovelDir)
}

pub(crate) fn config_from_state(state: &State<AppState>) -> Result<AppConfig> {
    let config_path = state
        .config_path
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    crate::services::config::load_config(&config_path)
}

/// 校验 filename 不含路径穿越组件，并确保 join + canonicalize 后仍在 base 内。
/// 防御 IPC 调用方传入 `../../etc/passwd` 等越界路径（P0-3，SPEC §5.4）。
pub(crate) fn safe_join(base: &Path, filename: &str) -> Result<PathBuf> {
    let p = Path::new(filename);
    // 拒绝绝对路径、父目录引用、盘符根（Windows）
    if p
        .components()
        .any(|c| matches!(c, Component::ParentDir | Component::RootDir))
    {
        return Err(AppError::Image(format!("非法文件名: {filename}")));
    }
    let joined = base.join(filename);
    // canonicalize 防 symlink 逃逸；文件不存在时退回 join 的逻辑路径做 starts_with 检查
    match joined.canonicalize() {
        Ok(canon) => {
            let base_canon = base.canonicalize()?;
            if !canon.starts_with(&base_canon) {
                return Err(AppError::Image("文件路径越界".to_string()));
            }
            Ok(canon)
        }
        Err(_) => {
            // 文件不存在：用 components 做保守检查（已通过上面的 Component 检查）
            Ok(joined)
        }
    }
}
