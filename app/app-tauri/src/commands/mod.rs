pub mod config;
pub mod export;
pub mod image;
pub mod novel;
pub mod system;

use std::path::PathBuf;

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
