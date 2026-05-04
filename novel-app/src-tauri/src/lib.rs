pub mod ai;
pub mod commands;
pub mod config;
pub mod error;
pub mod export;
pub mod files;
pub mod image;
pub mod novel;

use std::path::PathBuf;
use std::sync::Mutex;

use commands::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_path = dirs_config_path();
    let saved_dir = config::load_config(&config_path)
        .ok()
        .and_then(|c| c.novel_dir)
        .map(PathBuf::from);
    let saved_dir_for_setup = saved_dir.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            novel_dir: Mutex::new(saved_dir),
            config_path: Mutex::new(config_path),
            outline_generation: Mutex::new(Default::default()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::select_novel_dir,
            commands::get_novel_dir,
            commands::create_novel,
            commands::generate_outline,
            commands::start_outline_generation,
            commands::get_outline_generation_status,
            commands::generate_chapter,
            commands::get_status,
            commands::list_chapters,
            commands::read_chapter,
            commands::load_config,
            commands::save_config,
            commands::ollama_list_models,
            commands::ollama_test_connection,
            commands::get_export_data,
            commands::export_novel,
            commands::save_export_file,
            commands::generate_cover,
            commands::generate_character_image,
            commands::generate_scene_image,
            commands::extract_scene_description,
            commands::list_images,
            commands::delete_image,
            commands::get_image_path,
        ])
        .setup(move |app| {
            if let Some(dir) = saved_dir_for_setup.as_ref() {
                commands::allow_image_assets(app.handle(), dir)?;
            }

            let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .tooltip("AI 小说创作")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}

fn dirs_config_path() -> PathBuf {
    let config_dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let app_dir = config_dir.join("novel-app");
    let _ = std::fs::create_dir_all(&app_dir);
    app_dir.join("config.yaml")
}
