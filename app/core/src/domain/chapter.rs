use chrono::Local;

use crate::domain::config::{fill_template, AppConfig};
use crate::domain::types::*;
use crate::error::{AppError, Result};
use crate::progress::ProgressEvent;
use crate::services::ai;
use crate::storage;

pub async fn generate_chapter_streaming<F>(
    dir: &std::path::Path,
    config: &AppConfig,
    on_progress: F,
) -> Result<u32>
where
    F: Fn(ProgressEvent) + Clone + Send + Sync + 'static,
{
    let ctx = storage::read_context(dir)?;
    let chapter_num = ctx.current_chapter + 1;

    let novel = storage::read_novel(dir)?;
    let chapter_title = storage::get_chapter_outline(dir, chapter_num)?
        .ok_or(AppError::OutlineMissing(chapter_num))?;

    let prompt = build_chapter_prompt(&ctx, chapter_num, &chapter_title, &novel, config);

    let on_chunk = on_progress.clone();
    let content = ai::generate_streaming(config, &prompt, move |chunk| {
        on_chunk(ProgressEvent::ChapterChunk {
            chunk: chunk.to_string(),
            done: false,
        });
        Ok(())
    })
    .await?;

    // Write chapter file
    let ch_dir = storage::chapters_dir(dir);
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
    storage::write_file_atomic(&ch_dir.join(&filename), &file_content)?;

    on_progress(ProgressEvent::ChapterChunk {
        chunk: "\n\n[正在提取叙事记忆...]".to_string(),
        done: false,
    });

    crate::domain::memory::update_memory(dir, config, chapter_num, &content).await?;

    on_progress(ProgressEvent::ChapterChunk {
        chunk: String::new(),
        done: true,
    });

    Ok(chapter_num)
}

fn build_chapter_prompt(
    ctx: &ContextData,
    num: u32,
    title: &str,
    novel: &NovelData,
    config: &AppConfig,
) -> String {
    let genre = &novel.genre;
    let theme = &novel.theme;
    let words = novel.words_per_chapter.to_string();

    let intent_block = match &ctx.current_intent {
        Some(intent) => format!(
            "当前核心张力：{}\n读者关注点：{}",
            intent.obstacle, intent.reader_should_care
        ),
        None => "当前核心张力：主角在故事中面临新的挑战\n读者关注点：主角如何应对".to_string(),
    };

    let cs = if ctx.character_states.is_empty() {
        "- 暂无角色状态".to_string()
    } else {
        ctx.character_states
            .iter()
            .rev()
            .take(10)
            .map(|s| {
                if let Some(name) = s.get("name").and_then(|v| v.as_str()) {
                    let loc = s.get("location").and_then(|v| v.as_str()).unwrap_or("?");
                    let pw = s.get("power_level").and_then(|v| v.as_str()).unwrap_or("?");
                    let st = s.get("status").and_then(|v| v.as_str()).unwrap_or("正常");
                    format!("- {}：{}，{}，{}", name, loc, pw, st)
                } else {
                    format!("- {:?}", s)
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let pe = if ctx.plot_events.is_empty() {
        "- 暂无".to_string()
    } else {
        ctx.plot_events
            .iter()
            .rev()
            .take(8)
            .map(|e| format!("- {}", e))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let tc = if ctx.tension_checklist.is_empty() && ctx.unresolved_threads.is_empty() {
        "- 暂无".to_string()
    } else {
        let mut items = Vec::new();
        for t in ctx.tension_checklist.iter().rev().take(8) {
            let mark = if t.status == "resolved" { "x" } else { " " };
            items.push(format!("- [{}] {}", mark, t.item));
        }
        for t in ctx.unresolved_threads.iter().rev().take(8) {
            items.push(format!("- [ ] {}", t));
        }
        items.join("\n")
    };

    let ea = if ctx.emotional_arc.is_empty() {
        "暂无".to_string()
    } else {
        ctx.emotional_arc
            .iter()
            .rev()
            .take(6)
            .map(|e| format!("{}({})", e.tag, e.intensity))
            .collect::<Vec<_>>()
            .join(" → ")
    };

    fill_template(
        &config.prompts.chapter,
        &[
            ("genre", genre),
            ("theme", theme),
            ("intent_block", &intent_block),
            ("character_states", &cs),
            ("plot_events", &pe),
            ("tension_checklist", &tc),
            ("emotional_arc", &ea),
            ("num", &num.to_string()),
            ("title", title),
            ("words", &words),
        ],
    )
}
