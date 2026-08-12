//! 三层叙事记忆的持久化（P1-4 重构）。
//!
//! **格式**：YAML front matter（结构化）+ Markdown 正文（人读摘要）。
//! 与 `novel.md` 一致的双层格式。
//!
//! **历史问题**：旧版 write_context 把 `character_states` 等结构化数据拍平为
//! 人读文本行（`- 张三：京城，筑基，正常`），read_context 再按字符串前缀匹配
//! 读回——结构化的 name/location/power 变成裸字符串，`build_chapter_prompt`
//! 的 `.get("name")` 永远匹配失败，AI 看到的是噪音而非结构化角色信息，
//! 直接影响章节生成质量。
//!
//! **修复**：front matter 存结构化（serde 序列化），正文从 front matter 渲染。
//! 读取时先尝试解析 front matter，失败则 fallback 到旧的字符串匹配（兼容已有数据）。

use std::path::Path;

use super::{context_file, read_file_content, write_file_atomic};
use crate::domain::types::*;
use crate::error::Result;

/// 写入上下文。front matter 存结构化数据，正文从 front matter 渲染人读摘要。
pub fn write_context(dir: &Path, ctx: &ContextData) -> Result<()> {
    // serde_yaml::to_string 错误自动转 AppError::Yaml（#[from] serde_yaml::Error）
    let yaml = serde_yaml::to_string(ctx)?;
    let body = render_human_readable(ctx);
    let content = format!("---\n{yaml}---\n\n{body}");
    write_file_atomic(&context_file(dir), &content)
}

/// 渲染人读摘要（仅用于开发者查看 context.md 时的可读性，不参与反序列化）。
fn render_human_readable(ctx: &ContextData) -> String {
    let mut lines = vec![format!(
        "# 上下文摘要\n\n## 当前进度\n- 已完成：{}章\n",
        ctx.current_chapter
    )];
    if let Some(intent) = &ctx.current_intent {
        lines.push("## 叙事意图".to_string());
        lines.push(format!("- 角色想要：{}", intent.character_wants));
        lines.push(format!("- 阻碍：{}", intent.obstacle));
        lines.push(format!("- 读者关注：{}", intent.reader_should_care));
        lines.push(String::new());
    }
    if !ctx.character_states.is_empty() {
        lines.push("## 角色状态".to_string());
        for s in &ctx.character_states {
            let name = s.get("name").and_then(|v| v.as_str()).unwrap_or("?");
            let location = s.get("location").and_then(|v| v.as_str()).unwrap_or("?");
            let power = s.get("power_level").and_then(|v| v.as_str()).unwrap_or("?");
            let action = s
                .get("recent_action")
                .and_then(|v| v.as_str())
                .unwrap_or("?");
            lines.push(format!("- {}：{}，{}，{}", name, location, power, action));
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
    lines.join("\n")
}

/// 读取上下文。优先解析 YAML front matter（新格式），失败则 fallback
/// 到旧的字符串前缀匹配（兼容已存在的旧格式 context.md）。
pub fn read_context(dir: &Path) -> Result<ContextData> {
    let content = read_file_content(&context_file(dir))?;
    if content.is_empty() {
        return Ok(ContextData::default());
    }

    // 优先：新格式（YAML front matter）
    if content.starts_with("---\n") {
        if let Ok(ctx) = parse_front_matter(&content) {
            return Ok(ctx);
        }
        // front matter 解析失败，继续 fallback（可能是半迁移状态）
    }

    // Fallback：旧格式（纯 Markdown 字符串前缀匹配）
    Ok(parse_legacy_markdown(&content))
}

/// 解析 YAML front matter 为 ContextData。
fn parse_front_matter(content: &str) -> Result<ContextData> {
    let parts: Vec<&str> = content.splitn(3, "---\n").collect();
    if parts.len() < 3 {
        return Err(crate::error::AppError::Image(
            "context.md front matter 格式不完整".to_string(),
        ));
    }
    // serde_yaml::from_str 错误自动转 AppError::Yaml
    let ctx: ContextData = serde_yaml::from_str(parts[1])?;
    Ok(ctx)
}

/// 旧格式 fallback：纯 Markdown 字符串前缀匹配（兼容已有数据）。
/// 保留原 read_context 的逻辑，仅用于一次性迁移读取。
fn parse_legacy_markdown(content: &str) -> ContextData {
    let mut result = ContextData::default();
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
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// P1-4 核心回归：character_states 结构化数据往返不丢失结构。
    /// 旧版写入后读回变成 String，新版应为 Mapping，`.get("name")` 能命中。
    #[test]
    fn character_states_roundtrip_preserves_structure() {
        let dir = tempdir();
        let mut ctx = ContextData {
            current_chapter: 3,
            ..ContextData::default()
        };
        // 构造结构化角色状态（模拟 memory.rs merge_facts 后的形态）
        let mut state = serde_yaml::Mapping::new();
        state.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String("张三".into()),
        );
        state.insert(
            serde_yaml::Value::String("location".into()),
            serde_yaml::Value::String("京城".into()),
        );
        state.insert(
            serde_yaml::Value::String("power_level".into()),
            serde_yaml::Value::String("筑基".into()),
        );
        state.insert(
            serde_yaml::Value::String("status".into()),
            serde_yaml::Value::String("正常".into()),
        );
        ctx.character_states.push(serde_yaml::Value::Mapping(state));
        ctx.plot_events.push("第一卷·初入江湖".into());

        write_context(&dir, &ctx).unwrap();
        let read_back = read_context(&dir).unwrap();

        assert_eq!(read_back.current_chapter, 3);
        assert_eq!(read_back.plot_events.len(), 1);
        // 关键断言：读回的 character_states 仍为 Mapping，name 字段可提取
        assert_eq!(read_back.character_states.len(), 1);
        let s = &read_back.character_states[0];
        assert_eq!(
            s.get("name").and_then(|v| v.as_str()),
            Some("张三"),
            "character_states 往返后应保留结构，能提取 name 字段"
        );
        assert_eq!(s.get("location").and_then(|v| v.as_str()), Some("京城"));
        assert_eq!(s.get("power_level").and_then(|v| v.as_str()), Some("筑基"));
    }

    /// 向后兼容：旧格式 context.md（纯 Markdown）仍能读取。
    #[test]
    fn legacy_markdown_format_still_readable() {
        let dir = tempdir();
        let legacy = "# 上下文摘要\n\n## 当前进度\n- 已完成：5章\n\n## 关键事件\n- 第一卷·开端\n- 角色登场\n";
        std::fs::write(context_file(&dir), legacy).unwrap();

        let ctx = read_context(&dir).unwrap();
        assert_eq!(ctx.current_chapter, 5);
        assert_eq!(ctx.plot_events.len(), 2);
        assert_eq!(ctx.plot_events[0], "第一卷·开端");
    }

    /// 空文件 / 不存在文件返回默认值。
    #[test]
    fn empty_or_missing_returns_default() {
        let dir = tempdir();
        let ctx = read_context(&dir).unwrap();
        assert_eq!(ctx.current_chapter, 0);
        assert!(ctx.character_states.is_empty());
    }

    fn tempdir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "aw-ctx-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}
