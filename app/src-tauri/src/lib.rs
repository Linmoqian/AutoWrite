pub mod commands;
pub mod domain;
pub mod error;
pub mod services;
pub mod state;

use std::path::PathBuf;

use state::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_path = dirs_config_path();
    let saved_dir = services::config::load_config(&config_path)
        .ok()
        .and_then(|c| c.novel_dir)
        .map(PathBuf::from);
    let saved_dir_for_setup = saved_dir.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            novel_dir: std::sync::Mutex::new(saved_dir),
            config_path: std::sync::Mutex::new(config_path),
            outline_generation: std::sync::Mutex::new(Default::default()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::select_novel_dir,
            commands::system::get_novel_dir,
            commands::novel::create_novel,
            commands::novel::generate_outline,
            commands::novel::start_outline_generation,
            commands::novel::get_outline_generation_status,
            commands::novel::generate_chapter,
            commands::novel::get_status,
            commands::novel::list_chapters,
            commands::novel::read_chapter,
            commands::config::load_config,
            commands::config::save_config,
            commands::system::test_ai_connection,
            commands::config::ollama_list_models,
            commands::config::ollama_test_connection,
            commands::export::get_export_data,
            commands::export::export_novel,
            commands::export::save_export_file,
            commands::image::generate_cover,
            commands::image::generate_character_image,
            commands::image::generate_scene_image,
            commands::image::extract_scene_description,
            commands::image::list_images,
            commands::image::delete_image,
            commands::image::get_image_path,
        ])
        .setup(move |app| {
            if let Some(dir) = saved_dir_for_setup.as_ref() {
                commands::system::allow_image_assets(app.handle(), dir)?;
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
    let app_dir = config_dir.join("autowrite");
    let _ = std::fs::create_dir_all(&app_dir);
    app_dir.join("config.yaml")
}
