use chrono::Local;
use tauri::Emitter;

use crate::domain::config::{fill_template, AppConfig};
use crate::domain::types::*;
use crate::domain::util::map_step;
use crate::error::{AppError, Result};
use crate::services::{ai, files};

#[derive(Debug, serde::Serialize)]
pub struct NovelStatus {
    pub novel: NovelData,
    pub context: ContextData,
    pub outline: Vec<Volume>,
    pub total_chapters: u32,
    pub written_chapters: u32,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OutlineProgressEvent {
    step: String,
    chunk: String,
    done: bool,
}

pub fn create_novel(
    dir: &std::path::Path,
    title: &str,
    genre: &str,
    theme: &str,
    chapters: u32,
    config: &AppConfig,
    overwrite: bool,
) -> Result<()> {
    let novel_path = files::novel_file(dir);
    if novel_path.exists() && !overwrite {
        return Err(AppError::NovelAlreadyExists(files::read_novel(dir)?.title));
    }

    if overwrite {
        let outline_path = files::outline_file(dir);
        if outline_path.exists() {
            let _ = std::fs::remove_file(&outline_path);
            let _ = std::fs::remove_file(format!("{}.bak", outline_path.display()));
        }
        let chapters_dir = files::chapters_dir(dir);
        if chapters_dir.exists() {
            let _ = std::fs::remove_dir_all(&chapters_dir);
        }
    }

    let data = NovelData {
        title: title.to_string(),
        genre: genre.to_string(),
        theme: theme.to_string(),
        target_chapters: chapters,
        words_per_chapter: 3000,
        model: config.model.clone(),
        created: Local::now().format("%Y-%m-%d").to_string(),
        world: None,
        characters: None,
    };
    files::write_novel(dir, &data)?;
    files::write_context(dir, &ContextData::default())?;
    Ok(())
}

pub async fn generate_outline_streaming(
    dir: &std::path::Path,
    config: &AppConfig,
    app: &tauri::AppHandle,
) -> Result<String> {
    generate_outline_streaming_with_progress(dir, config, app, "", |_step, _chunk, _done| {}).await
}

pub async fn generate_outline_streaming_with_progress<F>(
    dir: &std::path::Path,
    config: &AppConfig,
    app: &tauri::AppHandle,
    target_step: &str,
    on_progress: F,
) -> Result<String>
where
    F: Fn(&str, &str, bool) + Clone + Send + Sync + 'static,
{
    let novel = files::read_novel(dir)?;

    let emit_skip = |step: &str| {
        on_progress(step, "", true);
        let _ = app.emit(
            "outline-progress",
            OutlineProgressEvent {
                step: map_step(step).to_string(),
                chunk: String::new(),
                done: true,
            },
        );
    };

    let need_world = target_step.is_empty() || target_step == "world";
    let need_characters = target_step.is_empty() || target_step == "characters";
    let need_outline = target_step.is_empty() || target_step == "outline";

    // Step 1: world
    let world = if need_world {
        let prompt = fill_template(
            &config.prompts.world,
            &[("genre", &novel.genre), ("theme", &novel.theme)],
        );
        let result =
            streaming_step(config, &prompt, app.clone(), "world", on_progress.clone()).await?;
        let mut n = files::read_novel(dir)?;
        n.world = Some(result.clone());
        files::write_novel(dir, &n)?;
        result
    } else {
        emit_skip("world");
        novel.world.clone().unwrap_or_default()
    };

    // Step 2: characters
    let characters = if need_characters {
        let prompt = fill_template(&config.prompts.character, &[("world", &world)]);
        let result = streaming_step(
            config,
            &prompt,
            app.clone(),
            "characters",
            on_progress.clone(),
        )
        .await?;
        let mut n = files::read_novel(dir)?;
        n.characters = Some(result.clone());
        files::write_novel(dir, &n)?;
        result
    } else {
        emit_skip("characters");
        novel.characters.clone().unwrap_or_default()
    };

    // Step 3: outline
    let outline_text = if need_outline {
        let novel = files::read_novel(dir)?;
        let prompt = fill_template(
            &config.prompts.outline,
            &[
                ("world", &world),
                ("characters", &characters),
                ("total_chapters", &novel.target_chapters.to_string()),
            ],
        );
        let result =
            streaming_step(config, &prompt, app.clone(), "outline", on_progress.clone()).await?;
        let outline = files::parse_outline_text(&result)?;
        files::write_outline(dir, &outline)?;
        result
    } else {
        emit_skip("outline");
        String::new()
    };

    Ok(outline_text)
}

async fn streaming_step<F>(
    config: &AppConfig,
    prompt: &str,
    app: tauri::AppHandle,
    step: &str,
    on_progress: F,
) -> Result<String>
where
    F: Fn(&str, &str, bool) + Clone + Send + Sync + 'static,
{
    let step_owned = step.to_string();
    let callback_step = step.to_string();
    let on_chunk = on_progress.clone();
    let app_for_done = app.clone();
    let result = ai::generate_streaming(config, prompt, move |chunk| {
        on_chunk(&callback_step, chunk, false);
        let _ = app.emit(
            "outline-progress",
            OutlineProgressEvent {
                step: map_step(&step_owned).to_string(),
                chunk: chunk.to_string(),
                done: false,
            },
        );
        Ok(())
    })
    .await;

    on_progress(step, "", true);
    let _ = app_for_done.emit(
        "outline-progress",
        OutlineProgressEvent {
            step: map_step(step).to_string(),
            chunk: String::new(),
            done: true,
        },
    );

    result
}

pub fn get_status(dir: &std::path::Path) -> Result<NovelStatus> {
    let novel = files::read_novel(dir)?;
    let context = files::read_context(dir)?;
    let outline = files::read_outline(dir)?;
    let chapters = files::list_chapters(dir)?;
    let total_chapters: u32 = outline.iter().map(|v| v.chapters.len() as u32).sum();
    let written_chapters = chapters.len() as u32;

    Ok(NovelStatus {
        novel,
        context,
        outline,
        total_chapters,
        written_chapters,
    })
}
