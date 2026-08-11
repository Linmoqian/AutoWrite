use regex::Regex;
use serde_json::Value;
use std::path::Path;

use crate::domain::config::{fill_template, AppConfig};
use crate::domain::types::*;
use crate::error::Result;
use crate::services::{ai, files};

pub async fn update_memory(
    dir: &Path,
    config: &AppConfig,
    chapter_num: u32,
    content: &str,
) -> Result<()> {
    let mut ctx = files::read_context(dir)?;
    let truncated = &content[..content.len().min(3000)];

    if let Ok(facts) = extract_facts(config, truncated).await {
        merge_facts(&mut ctx, &facts);
    }

    if let Ok(intent) = extract_intent(config, truncated).await {
        ctx.current_intent = Some(intent);
    }

    if let Ok(tags) = extract_emotion(config, truncated).await {
        ctx.emotional_arc.extend(tags);
        let keep = ctx.emotional_arc.len().saturating_sub(15);
        ctx.emotional_arc = ctx.emotional_arc.split_off(keep);
    }

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

async fn extract_intent(config: &AppConfig, content: &str) -> Result<NarrativeIntent> {
    let prompt = fill_template(&config.prompts.extract_intent, &[("content", content)]);
    let raw = ai::generate(config, &prompt).await?;
    let json = parse_json_response(&raw)?;
    Ok(NarrativeIntent {
        character_wants: json["character_wants"].as_str().unwrap_or("").to_string(),
        obstacle: json["obstacle"].as_str().unwrap_or("").to_string(),
        reader_should_care: json["reader_should_care"]
            .as_str()
            .unwrap_or("")
            .to_string(),
    })
}

async fn extract_emotion(config: &AppConfig, content: &str) -> Result<Vec<EmotionalTag>> {
    let prompt = fill_template(&config.prompts.extract_emotion, &[("content", content)]);
    let raw = ai::generate(config, &prompt).await?;
    let json = parse_json_response(&raw)?;
    let mut tags = Vec::new();
    if let Some(arr) = json["tags"].as_array() {
        for t in arr {
            let tag = t["tag"].as_str().unwrap_or("").to_string();
            let intensity = t["intensity"].as_u64().unwrap_or(1) as u32;
            if !tag.is_empty() {
                tags.push(EmotionalTag { tag, intensity });
            }
        }
    }
    Ok(tags)
}

fn parse_json_response(text: &str) -> Result<Value> {
    let re = Regex::new(
        r"(?s)```(?:json)?\s*
?(.*?)```",
    )
    .unwrap();
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

    if let Some(events) = facts["plot_events"].as_array() {
        for e in events {
            if let Some(s) = e.as_str() {
                ctx.plot_events.push(s.to_string());
            }
        }
        let keep = ctx.plot_events.len().saturating_sub(20);
        ctx.plot_events = ctx.plot_events.split_off(keep);
    }

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
        let exists = ctx.tension_checklist.iter().any(|tc| tc.item == *t);
        if !exists {
            ctx.tension_checklist.push(TensionItem {
                item: t.clone(),
                status: "open".to_string(),
            });
        }
    }
    let keep = ctx.tension_checklist.len().saturating_sub(15);
    ctx.tension_checklist = ctx.tension_checklist.split_off(keep);
}
