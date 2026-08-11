use std::path::Path;

use crate::domain::types::*;
use crate::error::Result;
use super::{context_file, read_file_content, write_file_atomic};

pub fn write_context(dir: &Path, ctx: &ContextData) -> Result<()> {
    let mut lines = vec![
        format!("# 上下文摘要\n\n## 当前进度\n- 已完成：{}章\n", ctx.current_chapter),
    ];
    if let Some(ref intent) = ctx.current_intent {
        lines.push("## 叙事意图".to_string());
        lines.push(format!("- 角色想要：{}", intent.character_wants));
        lines.push(format!("- 阻碍：{}", intent.obstacle));
        lines.push(format!("- 读者关注：{}", intent.reader_should_care));
        lines.push(String::new());
    }
    if !ctx.character_states.is_empty() {
        lines.push("## 角色状态".to_string());
        for s in &ctx.character_states {
            if let Some(name) = s.get("name").and_then(|v| v.as_str()) {
                let location = s.get("location").and_then(|v| v.as_str()).unwrap_or("?");
                let power = s.get("power_level").and_then(|v| v.as_str()).unwrap_or("?");
                let action = s.get("recent_action").and_then(|v| v.as_str()).unwrap_or("?");
                lines.push(format!("- {}：{}，{}，{}", name, location, power, action));
            }
        }
        lines.push(String::new());
    }
    if !ctx.plot_events.is_empty() {
        lines.push("## 关键事件".to_string());
        for e in ctx.plot_events.iter().rev().take(10) {
            lines.push(format!("- {}", e));
        }
        lines.push(String::new());
    }
    if !ctx.tension_checklist.is_empty() {
        lines.push("## 张力清单".to_string());
        for t in ctx.tension_checklist.iter().rev().take(10) {
            let mark = if t.status == "resolved" { "x" } else { " " };
            lines.push(format!("- [{}] {}", mark, t.item));
        }
        lines.push(String::new());
    }
    if !ctx.emotional_arc.is_empty() {
        lines.push("## 情感弧线".to_string());
        for e in ctx.emotional_arc.iter().rev().take(8) {
            lines.push(format!("- {}({})", e.tag, e.intensity));
        }
        lines.push(String::new());
    }
    write_file_atomic(&context_file(dir), &lines.join("\n"))
}

pub fn read_context(dir: &Path) -> Result<ContextData> {
    let content = read_file_content(&context_file(dir))?;
    let mut result = ContextData::default();
    if content.is_empty() {
        return Ok(result);
    }
    let mut section: Option<&str> = None;
    for line in content.lines() {
        match line.trim() {
            s if s.starts_with("## 当前进度") => section = Some("progress"),
            s if s.starts_with("## 剧情摘要") => section = Some("summaries"),
            s if s.starts_with("## 角色状态") => section = Some("characters"),
            s if s.starts_with("## 待埋伏笔") => section = Some("plots"),
            s if s.starts_with("## 叙事意图") => section = Some("intent"),
            s if s.starts_with("## 关键事件") => section = Some("events"),
            s if s.starts_with("## 未解决悬念") => section = Some("threads"),
            s if s.starts_with("## 张力清单") => section = Some("tension"),
            s if s.starts_with("## 情感弧线") => section = Some("emotion"),
            s if !s.is_empty() => match section {
                Some("progress") if s.contains("已完成：") => {
                    if let Some(idx) = s.find("已完成：") {
                        let num_str = s[idx + "已完成：".len()..].replace("章", "");
                        if let Ok(n) = num_str.trim().parse::<u32>() {
                            result.current_chapter = n;
                        }
                    }
                }
                Some("summaries") if !s.starts_with("#") => {
                    result.recent_summaries.push(s.to_string());
                }
                Some("characters") if s.starts_with("- ") => {
                    result
                        .character_states
                        .push(serde_yaml::Value::String(s[2..].to_string()));
                }
                Some("plots") if s.starts_with("- ") => {
                    result.pending_plots.push(s[2..].to_string());
                }
                Some("intent") if s.starts_with("- ") => {
                    let text = &s[2..];
                    if result.current_intent.is_none() {
                        result.current_intent = Some(NarrativeIntent {
                            character_wants: String::new(),
                            obstacle: String::new(),
                            reader_should_care: String::new(),
                        });
                    }
                    if let Some(ref mut intent) = result.current_intent {
                        if let Some(rest) = text.strip_prefix("角色想要：") {
                            intent.character_wants = rest.to_string();
                        } else if let Some(rest) = text.strip_prefix("阻碍：") {
                            intent.obstacle = rest.to_string();
                        } else if let Some(rest) = text.strip_prefix("读者关注：") {
                            intent.reader_should_care = rest.to_string();
                        }
                    }
                }
                Some("events") if s.starts_with("- ") => {
                    result.plot_events.push(s[2..].to_string());
                }
                Some("threads") if s.starts_with("- [ ] ") => {
                    result.unresolved_threads.push(s[6..].to_string());
                }
                Some("tension") if s.starts_with("- [") => {
                    let mark = s.chars().nth(3).unwrap_or(' ');
                    let item = s.get(6..).unwrap_or("").to_string();
                    result.tension_checklist.push(TensionItem {
                        item,
                        status: if mark == 'x' {
                            "resolved".to_string()
                        } else {
                            "open".to_string()
                        },
                    });
                }
                Some("emotion") if s.starts_with("- ") => {
                    let text = &s[2..];
                    if let Some(pos) = text.rfind('(') {
                        let tag = text[..pos].to_string();
                        let intensity_str = text[pos + 1..].trim_end_matches(')');
                        if let Ok(intensity) = intensity_str.parse::<u32>() {
                            result.emotional_arc.push(EmotionalTag { tag, intensity });
                        }
                    }
                }
                _ => {}
            },
            _ => {}
        }
    }
    Ok(result)
}
