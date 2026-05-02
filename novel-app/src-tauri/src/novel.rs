use chrono::Local;
use std::path::Path;

use crate::ai;
use crate::config::{fill_template, AppConfig};
use crate::error::{AppError, Result};
use crate::files::{
    self, ChapterMeta, ContextData, NovelData, Volume,
};

#[derive(Debug, serde::Serialize)]
pub struct NovelStatus {
    pub novel: NovelData,
    pub context: ContextData,
    pub outline: Vec<Volume>,
    pub total_chapters: u32,
    pub written_chapters: u32,
}

pub fn create_novel(
    dir: &Path,
    title: &str,
    genre: &str,
    theme: &str,
    chapters: u32,
    config: &AppConfig,
) -> Result<()> {
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
    let ctx = ContextData {
        current_chapter: 0,
        recent_summaries: Vec::new(),
        character_states: Vec::new(),
        pending_plots: Vec::new(),
    };
    files::write_context(dir, &ctx)?;
    Ok(())
}

pub async fn generate_world(dir: &Path, config: &AppConfig) -> Result<String> {
    let novel = files::read_novel(dir)?;
    let prompt = fill_template(
        &config.prompts.world,
        &[
            ("genre", &novel.genre),
            ("theme", &novel.theme),
        ],
    );
    let world = ai::generate(config, &prompt).await?;
    let mut novel = files::read_novel(dir)?;
    novel.world = Some(world.clone());
    files::write_novel(dir, &novel)?;
    Ok(world)
}

pub async fn generate_characters(dir: &Path, config: &AppConfig) -> Result<String> {
    let novel = files::read_novel(dir)?;
    let world = novel.world.as_deref().unwrap_or("");
    let prompt = fill_template(&config.prompts.character, &[("world", world)]);
    let characters = ai::generate(config, &prompt).await?;
    let mut novel = files::read_novel(dir)?;
    novel.characters = Some(characters.clone());
    files::write_novel(dir, &novel)?;
    Ok(characters)
}

pub async fn generate_outline(dir: &Path, config: &AppConfig) -> Result<String> {
    let world = generate_world(dir, config).await?;
    let characters = generate_characters(dir, config).await?;

    let novel = files::read_novel(dir)?;
    let prompt = fill_template(
        &config.prompts.outline,
        &[
            ("world", &world),
            ("characters", &characters),
            ("total_chapters", &novel.target_chapters.to_string()),
        ],
    );
    let outline_text = ai::generate(config, &prompt).await?;
    let outline = files::parse_outline_text(&outline_text)?;
    files::write_outline(dir, &outline)?;
    Ok(outline_text)
}

pub async fn generate_chapter(dir: &Path, config: &AppConfig) -> Result<u32> {
    let ctx = files::read_context(dir)?;
    let chapter_num = ctx.current_chapter + 1;

    let novel = files::read_novel(dir)?;
    let chapter_title = files::get_chapter_outline(dir, chapter_num)?
        .ok_or(AppError::OutlineMissing(chapter_num))?;

    let context_text = files::read_context_text(dir)?;
    let prompt = fill_template(
        &config.prompts.chapter,
        &[
            ("context", &context_text),
            ("num", &chapter_num.to_string()),
            ("title", &chapter_title),
            ("outline_detail", &format!("第{}章：{}", chapter_num, chapter_title)),
            ("words", &novel.words_per_chapter.to_string()),
            ("style", &format!("{}类型，{}主题", novel.genre, novel.theme)),
        ],
    );
    let content = ai::generate(config, &prompt).await?;

    let ch_dir = files::chapters_dir(dir);
    std::fs::create_dir_all(&ch_dir)?;

    let safe_title: String = chapter_title.chars().take(10).collect();
    let filename = format!("{:03}-{}.md", chapter_num, safe_title);
    let meta = ChapterMeta {
        chapter: chapter_num,
        title: chapter_title.clone(),
        words: content.len() as u32,
        created: Local::now().format("%Y-%m-%d").to_string(),
    };
    let meta_yaml = serde_yaml::to_string(&meta)?;
    let file_content = format!(
        "---\n{}---\n\n# 第{}章 {}\n\n{}",
        meta_yaml, chapter_num, chapter_title, content
    );
    files::write_file_atomic(&ch_dir.join(&filename), &file_content)?;

    let mut ctx = files::read_context(dir)?;
    let summary = match ai::generate(
        config,
        &format!("请用200字概括以下章节的剧情：\n{}", &content[..content.len().min(2000)]),
    )
    .await
    {
        Ok(s) => s,
        Err(_) => content[..content.len().min(200)].to_string(),
    };
    ctx.recent_summaries
        .push(format!("第{}章：{}", chapter_num, summary));
    let keep = ctx.recent_summaries.len().saturating_sub(5);
    ctx.recent_summaries = ctx.recent_summaries.split_off(keep);
    ctx.current_chapter = chapter_num;
    files::write_context(dir, &ctx)?;

    Ok(chapter_num)
}

pub fn get_status(dir: &Path) -> Result<NovelStatus> {
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
