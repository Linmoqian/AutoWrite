mod ai;
mod commands;
mod config;
mod error;
mod files;
mod novel;

use std::path::PathBuf;
use std::sync::Mutex;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_path = dirs_config_path();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            novel_dir: Mutex::new(None),
            config_path: Mutex::new(config_path),
        })
        .invoke_handler(tauri::generate_handler![
            commands::select_novel_dir,
            commands::get_novel_dir,
            commands::create_novel,
            commands::generate_outline,
            commands::generate_chapter,
            commands::get_status,
            commands::list_chapters,
            commands::read_chapter,
            commands::load_config,
            commands::save_config,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}

fn dirs_config_path() -> PathBuf {
    let config_dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let app_dir = config_dir.join("novel-app");
    let _ = std::fs::create_dir_all(&app_dir);
    app_dir.join("config.yaml")
}
