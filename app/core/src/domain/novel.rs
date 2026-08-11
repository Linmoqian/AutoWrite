use chrono::Local;

use crate::domain::config::{fill_template, AppConfig};
use crate::domain::types::*;
use crate::error::{AppError, Result};
use crate::progress::{OutlineStep, ProgressEvent};
use crate::services::ai;
use crate::storage;

#[derive(Debug, serde::Serialize)]
pub struct NovelStatus {
    pub novel: NovelData,
    pub context: ContextData,
    pub outline: Vec<Volume>,
    pub total_chapters: u32,
    pub written_chapters: u32,
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
    let novel_path = storage::novel_file(dir);
    if novel_path.exists() && !overwrite {
        return Err(AppError::NovelAlreadyExists(storage::read_novel(dir)?.title));
    }

    if overwrite {
        let outline_path = storage::outline_file(dir);
        if outline_path.exists() {
            let _ = std::fs::remove_file(&outline_path);
            let _ = std::fs::remove_file(format!("{}.bak", outline_path.display()));
        }
        let chapters_dir = storage::chapters_dir(dir);
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
    storage::write_novel(dir, &data)?;
    storage::write_context(dir, &ContextData::default())?;
    Ok(())
}

pub async fn generate_outline_streaming(
    dir: &std::path::Path,
    config: &AppConfig,
) -> Result<String> {
    generate_outline_streaming_with_progress(dir, config, "", |_| {}).await
}

pub async fn generate_outline_streaming_with_progress<F>(
    dir: &std::path::Path,
    config: &AppConfig,
    target_step: &str,
    on_progress: F,
) -> Result<String>
where
    F: Fn(ProgressEvent) + Clone + Send + Sync + 'static,
{
    let novel = storage::read_novel(dir)?;

    let emit_skip = |step: OutlineStep, on_progress: &F| {
        on_progress(ProgressEvent::OutlineStep {
            step,
            chunk: String::new(),
            done: true,
        });
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
            streaming_step(config, &prompt, OutlineStep::World, on_progress.clone()).await?;
        let mut n = storage::read_novel(dir)?;
        n.world = Some(result.clone());
        storage::write_novel(dir, &n)?;
        result
    } else {
        emit_skip(OutlineStep::World, &on_progress);
        novel.world.clone().unwrap_or_default()
    };

    // Step 2: characters
    let characters = if need_characters {
        let prompt = fill_template(&config.prompts.character, &[("world", &world)]);
        let result =
            streaming_step(config, &prompt, OutlineStep::Characters, on_progress.clone()).await?;
        let mut n = storage::read_novel(dir)?;
        n.characters = Some(result.clone());
        storage::write_novel(dir, &n)?;
        result
    } else {
        emit_skip(OutlineStep::Characters, &on_progress);
        novel.characters.clone().unwrap_or_default()
    };

    // Step 3: outline
    let outline_text = if need_outline {
        let novel = storage::read_novel(dir)?;
        let prompt = fill_template(
            &config.prompts.outline,
            &[
                ("world", &world),
                ("characters", &characters),
                ("total_chapters", &novel.target_chapters.to_string()),
            ],
        );
        let result =
            streaming_step(config, &prompt, OutlineStep::Outline, on_progress.clone()).await?;
        let outline = storage::parse_outline_text(&result)?;
        storage::write_outline(dir, &outline)?;
        result
    } else {
        emit_skip(OutlineStep::Outline, &on_progress);
        String::new()
    };

    Ok(outline_text)
}

async fn streaming_step<F>(
    config: &AppConfig,
    prompt: &str,
    step: OutlineStep,
    on_progress: F,
) -> Result<String>
where
    F: Fn(ProgressEvent) + Clone + Send + Sync + 'static,
{
    let on_chunk = on_progress.clone();
    let step_for_chunk = step;
    let result = ai::generate_streaming(config, prompt, move |chunk| {
        on_chunk(ProgressEvent::OutlineStep {
            step: step_for_chunk,
            chunk: chunk.to_string(),
            done: false,
        });
        Ok(())
    })
    .await;

    on_progress(ProgressEvent::OutlineStep {
        step,
        chunk: String::new(),
        done: true,
    });

    result
}

pub fn get_status(dir: &std::path::Path) -> Result<NovelStatus> {
    let novel = storage::read_novel(dir)?;
    let context = storage::read_context(dir)?;
    let outline = storage::read_outline(dir)?;
    let chapters = storage::list_chapters(dir)?;
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
