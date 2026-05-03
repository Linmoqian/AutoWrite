use chrono::Local;
use regex::Regex;
use serde_json::Value;
use std::path::Path;
use tauri::Emitter;

use crate::ai;
use crate::config::{fill_template, AppConfig};
use crate::error::{AppError, Result};
use crate::files::{self, ContextData, ChapterMeta, NovelData, Volume};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OutlineProgressEvent {
    step: String,
    chunk: String,
    done: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ChapterProgressEvent {
    chunk: String,
    done: bool,
}

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
    overwrite: bool,
) -> Result<()> {
    let novel_path = files::novel_file(dir);
    if novel_path.exists() && !overwrite {
        return Err(AppError::NovelAlreadyExists(
            files::read_novel(dir)?.title,
        ));
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
    dir: &Path,
    config: &AppConfig,
    app: &tauri::AppHandle,
) -> Result<String> {
    let steps = ["world", "characters", "outline"];

    // Step 1: 生成世界观
    let novel = files::read_novel(dir)?;
    let prompt = fill_template(
        &config.prompts.world,
        &[("genre", &novel.genre), ("theme", &novel.theme)],
    );
    let app_w = app.clone();
    let world = streaming_step(config, &prompt, app_w, steps[0]).await?;
    let mut novel = files::read_novel(dir)?;
    novel.world = Some(world.clone());
    files::write_novel(dir, &novel)?;

    // Step 2: 生成角色
    let prompt = fill_template(&config.prompts.character, &[("world", &world)]);
    let app_c = app.clone();
    let characters = streaming_step(config, &prompt, app_c, steps[1]).await?;
    let mut novel = files::read_novel(dir)?;
    novel.characters = Some(characters.clone());
    files::write_novel(dir, &novel)?;

    // Step 3: 生成大纲
    let novel = files::read_novel(dir)?;
    let prompt = fill_template(
        &config.prompts.outline,
        &[
            ("world", &world),
            ("characters", &characters),
            ("total_chapters", &novel.target_chapters.to_string()),
        ],
    );
    let app_o = app.clone();
    let outline_text = streaming_step(config, &prompt, app_o, steps[2]).await?;
    let outline = files::parse_outline_text(&outline_text)?;
    files::write_outline(dir, &outline)?;

    Ok(outline_text)
}

async fn streaming_step(
    config: &AppConfig,
    prompt: &str,
    app: tauri::AppHandle,
    step: &str,
) -> Result<String> {
    let step_owned = step.to_string();
    let app_for_done = app.clone();
    let result = ai::generate_streaming(config, prompt, move |chunk| {
        let _ = app.emit(
            "outline-progress",
            OutlineProgressEvent {
                step: step_owned.clone(),
                chunk: chunk.to_string(),
                done: false,
            },
        );
        Ok(())
    })
    .await;

    // 发送完成事件
    let _ = app_for_done.emit(
        "outline-progress",
        OutlineProgressEvent {
            step: step.to_string(),
            chunk: String::new(),
            done: true,
        },
    );

    result
}

pub async fn generate_chapter_streaming(
    dir: &Path,
    config: &AppConfig,
    app: &tauri::AppHandle,
) -> Result<u32> {
    let ctx = files::read_context(dir)?;
    let chapter_num = ctx.current_chapter + 1;

    let novel = files::read_novel(dir)?;
    let chapter_title =
        files::get_chapter_outline(dir, chapter_num)?.ok_or(AppError::OutlineMissing(chapter_num))?;

    let prompt = build_chapter_prompt(&ctx, chapter_num, &chapter_title, &novel, config);

    // 流式生成章节内容
    let app_clone = app.clone();
    let content = ai::generate_streaming(config, &prompt, move |chunk| {
        let _ = app_clone.emit(
            "chapter-progress",
            ChapterProgressEvent {
                chunk: chunk.to_string(),
                done: false,
            },
        );
        Ok(())
    })
    .await?;

    // 写入章节文件
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

    // 通知前端进入后处理阶段
    let _ = app.emit(
        "chapter-progress",
        ChapterProgressEvent {
            chunk: "\n\n[正在提取叙事记忆...]".to_string(),
            done: false,
        },
    );

    // 三次提取 + 更新三层记忆
    update_memory(dir, config, chapter_num, &content).await?;

    // 生成完成
    let _ = app.emit(
        "chapter-progress",
        ChapterProgressEvent {
            chunk: String::new(),
            done: true,
        },
    );

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

    // 叙事意图块
    let intent_block = match &ctx.current_intent {
        Some(intent) => format!(
            "当前核心张力：{}\n读者关注点：{}",
            intent.obstacle, intent.reader_should_care
        ),
        None => "当前核心张力：主角在故事中面临新的挑战\n读者关注点：主角如何应对".to_string(),
    };

    // 角色状态
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

    // 关键事件
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

    // 张力清单
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

    // 情感弧线
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

async fn update_memory(
    dir: &Path,
    config: &AppConfig,
    chapter_num: u32,
    content: &str,
) -> Result<()> {
    let mut ctx = files::read_context(dir)?;
    let truncated = &content[..content.len().min(3000)];

    // 提取结构化事实
    if let Ok(facts) = extract_facts(config, truncated).await {
        merge_facts(&mut ctx, &facts);
    }

    // 提取叙事意图
    if let Ok(intent) = extract_intent(config, truncated).await {
        ctx.current_intent = Some(intent);
    }

    // 提取情感弧线
    if let Ok(tags) = extract_emotion(config, truncated).await {
        ctx.emotional_arc.extend(tags);
        let keep = ctx.emotional_arc.len().saturating_sub(15);
        ctx.emotional_arc = ctx.emotional_arc.split_off(keep);
    }

    // 更新张力清单
    update_tension(&mut ctx);

    ctx.current_chapter = chapter_num;
    files::write_context(dir, &ctx)?;
    Ok(())
}

async fn extract_facts(config: &AppConfig, content: &str) -> Result<Value> {
    let prompt = fill_template(&config.prompts.extract_facts, &[("content", content)]);
    let raw = ai::generate(config, &prompt).await?;
    parse_json_response(&raw)
}

async fn extract_intent(
    config: &AppConfig,
    content: &str,
) -> Result<files::NarrativeIntent> {
    let prompt = fill_template(&config.prompts.extract_intent, &[("content", content)]);
    let raw = ai::generate(config, &prompt).await?;
    let json = parse_json_response(&raw)?;
    Ok(files::NarrativeIntent {
        character_wants: json["character_wants"].as_str().unwrap_or("").to_string(),
        obstacle: json["obstacle"].as_str().unwrap_or("").to_string(),
        reader_should_care: json["reader_should_care"].as_str().unwrap_or("").to_string(),
    })
}

async fn extract_emotion(
    config: &AppConfig,
    content: &str,
) -> Result<Vec<files::EmotionalTag>> {
    let prompt = fill_template(&config.prompts.extract_emotion, &[("content", content)]);
    let raw = ai::generate(config, &prompt).await?;
    let json = parse_json_response(&raw)?;
    let mut tags = Vec::new();
    if let Some(arr) = json["tags"].as_array() {
        for t in arr {
            let tag = t["tag"].as_str().unwrap_or("").to_string();
            let intensity = t["intensity"].as_u64().unwrap_or(1) as u32;
            if !tag.is_empty() {
                tags.push(files::EmotionalTag { tag, intensity });
            }
        }
    }
    Ok(tags)
}

fn parse_json_response(text: &str) -> Result<Value> {
    let re = Regex::new(r"(?s)```(?:json)?\s*\n?(.*?)```").unwrap();
    let candidate = match re.captures(text) {
        Some(caps) => caps[1].trim().to_string(),
        None => text.trim().to_string(),
    };
    let start = candidate.find('{').unwrap_or(0);
    let end = candidate.rfind('}').unwrap_or(0);
    if end > start {
        let json_str = &candidate[start..=end];
        Ok(serde_json::from_str(json_str)?)
    } else {
        Ok(serde_json::from_str(&candidate)?)
    }
}

fn merge_facts(ctx: &mut ContextData, facts: &Value) {
    // 合并角色状态
    if let Some(states) = facts["character_states"].as_array() {
        for ns in states {
            let new_name = ns["name"].as_str().unwrap_or("");
            if new_name.is_empty() {
                continue;
            }
            let new_state = serde_yaml::to_value(ns).unwrap_or(serde_yaml::Value::Null);
            let idx = ctx.character_states.iter().position(|s| {
                s.get("name")
                    .and_then(|v| v.as_str())
                    .map(|n| n == new_name)
                    .unwrap_or(false)
            });
            match idx {
                Some(i) => ctx.character_states[i] = new_state,
                None => ctx.character_states.push(new_state),
            }
        }
        let keep = ctx.character_states.len().saturating_sub(20);
        ctx.character_states = ctx.character_states.split_off(keep);
    }

    // 合并关键事件
    if let Some(events) = facts["plot_events"].as_array() {
        for e in events {
            if let Some(s) = e.as_str() {
                ctx.plot_events.push(s.to_string());
            }
        }
        let keep = ctx.plot_events.len().saturating_sub(20);
        ctx.plot_events = ctx.plot_events.split_off(keep);
    }

    // 合并未解决悬念
    if let Some(threads) = facts["unresolved_threads"].as_array() {
        for t in threads {
            if let Some(s) = t.as_str() {
                if !ctx.unresolved_threads.contains(&s.to_string()) {
                    ctx.unresolved_threads.push(s.to_string());
                }
            }
        }
        let keep = ctx.unresolved_threads.len().saturating_sub(15);
        ctx.unresolved_threads = ctx.unresolved_threads.split_off(keep);
    }
}

fn update_tension(ctx: &mut ContextData) {
    for t in &ctx.unresolved_threads {
        let exists = ctx
            .tension_checklist
            .iter()
            .any(|tc| tc.item == *t);
        if !exists {
            ctx.tension_checklist.push(files::TensionItem {
                item: t.clone(),
                status: "open".to_string(),
            });
        }
    }
    let keep = ctx.tension_checklist.len().saturating_sub(15);
    ctx.tension_checklist = ctx.tension_checklist.split_off(keep);
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
