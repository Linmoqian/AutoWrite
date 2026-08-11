use tauri::State;

use crate::error::Result;
use crate::state::AppState;
use super::dir_from_state;

#[tauri::command]
pub fn get_export_data(state: State<'_, AppState>) -> Result<crate::services::export::ExportData> {
    let dir = dir_from_state(&state)?;
    crate::services::export::collect_export_data(&dir)
}

#[tauri::command]
pub async fn export_novel(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    format: String,
) -> Result<String> {
    use tauri_plugin_dialog::DialogExt;

    let dir = dir_from_state(&state)?;
    let data = crate::services::export::collect_export_data(&dir)?;

    let content = match format.as_str() {
        "md" => crate::services::export::render_markdown(&data),
        "txt" => crate::services::export::render_plain_text(&data),
        _ => {
            return Err(crate::error::AppError::Export(format!(
                "不支持的格式: {}",
                format
            )))
        }
    };

    let ext = format.clone();
    let default_name = format!("{}.{}", data.novel.title, ext);
    let file_path = app
        .dialog()
        .file()
        .add_filter(&format.to_uppercase(), &[&ext])
        .set_file_name(&default_name)
        .blocking_save_file()
        .ok_or(crate::error::AppError::Export("用户取消导出".into()))?;

    let path = file_path
        .as_path()
        .ok_or(crate::error::AppError::Export("无效文件路径".into()))?;

    std::fs::write(path, content)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_export_file(
    app: tauri::AppHandle,
    content: Vec<u8>,
    filename: String,
    extension: String,
) -> Result<String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .add_filter(&extension.to_uppercase(), &[&extension])
        .set_file_name(&filename)
        .blocking_save_file()
        .ok_or(crate::error::AppError::Export("用户取消导出".into()))?;

    let path = file_path
        .as_path()
        .ok_or(crate::error::AppError::Export("无效文件路径".into()))?;

    std::fs::write(path, content)?;
    Ok(path.to_string_lossy().to_string())
}
