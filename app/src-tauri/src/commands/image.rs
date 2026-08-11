use tauri::{Emitter, State};

use crate::domain::config::ImagePrompts;
use crate::domain::types::NovelData;
use crate::error::Result;
use crate::services::image;
use crate::state::AppState;
use super::{config_from_state, dir_from_state};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageProgressEvent {
    pub stage: String,
    pub message: String,
    pub image_id: Option<String>,
}

async fn generate_image_common<F>(
    app: &tauri::AppHandle,
    state: &State<'_, AppState>,
    kind: image::ImageKind,
    ref_id: Option<String>,
    prompt_builder: F,
    preparing_msg: String,
    done_msg: String,
) -> Result<image::ImageResult>
where
    F: FnOnce(&NovelData, &ImagePrompts) -> String,
{
    let dir = dir_from_state(state)?;
    let config = config_from_state(state)?;
    let novel = crate::services::files::read_novel(&dir)?;

    let _ = app.emit(
        "image-progress",
        ImageProgressEvent {
            stage: "preparing".to_string(),
            message: preparing_msg,
            image_id: None,
        },
    );

    let prompt = prompt_builder(&novel, &config.image_prompts);

    let _ = app.emit(
        "image-progress",
        ImageProgressEvent {
            stage: "submitting".to_string(),
            message: "正在提交图片生成任务...".to_string(),
            image_id: None,
        },
    );

    let app_emit = app.clone();
    let generated = image::generate_image(&config, &prompt, |msg| {
        let _ = app_emit.emit(
            "image-progress",
            ImageProgressEvent {
                stage: "polling".to_string(),
                message: msg.to_string(),
                image_id: None,
            },
        );
    })
    .await?;

    let id = image::generate_id();
    let local_path = image::save_image_file(&dir, &kind, &id, &generated.bytes)?;

    let _ = app.emit(
        "image-progress",
        ImageProgressEvent {
            stage: "saving".to_string(),
            message: "正在保存图片...".to_string(),
            image_id: Some(id.clone()),
        },
    );

    let result = image::ImageResult {
        id: id.clone(),
        kind,
        prompt,
        revised_prompt: None,
        local_path,
        file_size: generated.bytes.len() as u64,
        created: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
        ref_id,
    };

    image::append_image_meta(&dir, &result)?;

    let _ = app.emit(
        "image-progress",
        ImageProgressEvent {
            stage: "done".to_string(),
            message: done_msg,
            image_id: Some(id),
        },
    );

    Ok(result)
}

#[tauri::command]
pub async fn generate_cover(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<image::ImageResult> {
    let novel = crate::services::files::read_novel(&dir_from_state(&state)?)?;
    let title = novel.title.clone();

    generate_image_common(
        &app,
        &state,
        image::ImageKind::Cover,
        None,
        |novel, prompts| {
            image::build_cover_prompt(prompts, &novel.title, &novel.genre, &novel.theme)
        },
        format!("正在为《{}》生成封面...", title),
        "封面生成完成".to_string(),
    )
    .await
}

#[tauri::command]
pub async fn generate_character_image(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    character_name: String,
    character_desc: String,
) -> Result<image::ImageResult> {
    let name = character_name.clone();
    let desc = character_desc.clone();

    generate_image_common(
        &app,
        &state,
        image::ImageKind::Character,
        Some(character_name.clone()),
        move |novel, prompts| {
            image::build_character_prompt(prompts, &novel.title, &name, &desc)
        },
        format!("正在为角色「{}」生成立绘...", character_name),
        format!("角色「{}」立绘生成完成", character_name),
    )
    .await
}

#[tauri::command]
pub async fn generate_scene_image(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    chapter_num: u32,
    scene_desc: String,
    mood: String,
) -> Result<image::ImageResult> {
    let dir = dir_from_state(&state)?;
    let chapter_title = crate::services::files::get_chapter_outline(&dir, chapter_num)?
        .unwrap_or_else(|| format!("第{}章", chapter_num));
    let title_for_msg = chapter_title.clone();

    let sd = scene_desc.clone();
    let md = mood.clone();

    generate_image_common(
        &app,
        &state,
        image::ImageKind::Scene,
        Some(format!("ch{:03}", chapter_num)),
        |novel, prompts| {
            image::build_scene_prompt(
                prompts,
                &novel.title,
                chapter_num,
                &chapter_title,
                &sd,
                &md,
            )
        },
        format!("正在为第{}章「{}」生成场景插图...", chapter_num, title_for_msg),
        format!("第{}章场景插图生成完成", chapter_num),
    )
    .await
}

#[tauri::command]
pub async fn extract_scene_description(
    state: State<'_, AppState>,
    chapter_num: u32,
) -> Result<image::SceneDescription> {
    let dir = dir_from_state(&state)?;
    let config = config_from_state(&state)?;

    let chapters = crate::services::files::list_chapters(&dir)?;
    let chapter = chapters
        .iter()
        .find(|c| c.chapter == chapter_num)
        .ok_or_else(|| crate::error::AppError::Image(format!("第 {} 章不存在", chapter_num)))?;

    let filename = format!("{:03}-{}.md", chapter_num, chapter.title);
    let (_, body) = crate::services::files::read_chapter(&dir, &filename)?;

    image::extract_scene(&config, &body).await
}

#[tauri::command]
pub fn list_images(state: State<'_, AppState>) -> Result<Vec<image::ImageResult>> {
    let dir = dir_from_state(&state)?;
    image::list_images(&dir)
}

#[tauri::command]
pub fn delete_image(state: State<'_, AppState>, image_id: String) -> Result<()> {
    let dir = dir_from_state(&state)?;
    image::delete_image(&dir, &image_id)
}

#[tauri::command]
pub fn get_image_path(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    filename: String,
) -> Result<String> {
    let dir = dir_from_state(&state)?;
    super::system::allow_image_assets(&app, &dir)?;
    let path = image::images_dir(&dir).join(&filename);
    if !path.exists() {
        return Err(crate::error::AppError::Image(format!(
            "图片文件不存在: {}",
            filename
        )));
    }
    Ok(path.to_string_lossy().to_string())
}
