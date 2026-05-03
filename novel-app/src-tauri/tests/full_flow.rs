use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use novel_app_lib::config::{self, AppConfig, Provider};
use novel_app_lib::files;
use novel_app_lib::novel;

fn setup_test_env() -> (PathBuf, AppConfig) {
    let api_key = std::env::var("NOVEL_API_KEY")
        .expect("请设置环境变量 NOVEL_API_KEY（DeepSeek API Key）");

    let dir = std::env::temp_dir().join("novel-app-test-full-flow");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    let config = AppConfig {
        novel_dir: None,
        provider: Provider::OpenAI,
        model: "deepseek-chat".to_string(),
        timeout: 300,
        ollama_url: "http://localhost:11434".to_string(),
        api_base_url: "https://api.deepseek.com".to_string(),
        api_key,
        prompts: config::Prompts::default(),
    };

    (dir, config)
}

fn step(step: &str, status: &str) {
    eprintln!(
        "  {} {}",
        match status {
            "ok" => "\x1b[32m✓\x1b[0m",
            "run" => "\x1b[33m→\x1b[0m",
            _ => " ",
        },
        step,
    );
}

fn first_chapter_filename(dir: &PathBuf) -> String {
    let ch_dir = files::chapters_dir(dir);
    for entry in std::fs::read_dir(&ch_dir).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            return path.file_name().unwrap().to_string_lossy().to_string();
        }
    }
    panic!("chapters/ 目录中没有 .md 文件");
}

#[tokio::test]
#[ignore] // 需要真实 API Key，用 cargo test -- --ignored 运行
async fn full_flow_create_outline_and_chapter() {
    let (dir, config) = setup_test_env();

    eprintln!("\n\x1b[1;36m━━━ 全流程集成测试 ━━━\x1b[0m\n");

    // ─── Step 1: 创建小说 ───
    step("创建小说", "run");
    novel::create_novel(&dir, "测试仙侠录", "xuanhuan", "逆天改命", 5, &config).unwrap();
    step("创建小说", "ok");

    let novel_data = files::read_novel(&dir).unwrap();
    assert_eq!(novel_data.title, "测试仙侠录");
    assert_eq!(novel_data.genre, "xuanhuan");
    assert_eq!(novel_data.target_chapters, 5);
    step("novel.md 元数据正确", "ok");

    let ctx = files::read_context(&dir).unwrap();
    assert_eq!(ctx.current_chapter, 0);
    step("context.md 初始化正确", "ok");

    // ─── Step 2: 生成世界观 ───
    step("调用 AI 生成世界观...", "run");
    let world_prompt = config::fill_template(
        &config.prompts.world,
        &[("genre", "xuanhuan"), ("theme", "逆天改命")],
    );
    let world = novel_app_lib::ai::generate(&config, &world_prompt)
        .await
        .expect("生成世界观失败，请检查 API Key 和网络");
    assert!(!world.is_empty(), "世界观内容为空");
    step(&format!("世界观生成完成 ({} 字)", world.len()), "ok");

    let mut novel_data = files::read_novel(&dir).unwrap();
    novel_data.world = Some(world.clone());
    files::write_novel(&dir, &novel_data).unwrap();

    // ─── Step 3: 生成角色 ───
    step("调用 AI 生成角色...", "run");
    let char_prompt = config::fill_template(&config.prompts.character, &[("world", &world)]);
    let characters = novel_app_lib::ai::generate(&config, &char_prompt)
        .await
        .expect("生成角色失败");
    assert!(!characters.is_empty(), "角色内容为空");
    step(&format!("角色生成完成 ({} 字)", characters.len()), "ok");

    novel_data = files::read_novel(&dir).unwrap();
    novel_data.characters = Some(characters.clone());
    files::write_novel(&dir, &novel_data).unwrap();

    // ─── Step 4: 生成大纲 ───
    step("调用 AI 生成大纲...", "run");
    let outline_prompt = config::fill_template(
        &config.prompts.outline,
        &[
            ("world", &world),
            ("characters", &characters),
            ("total_chapters", "5"),
        ],
    );
    let outline_text = novel_app_lib::ai::generate(&config, &outline_prompt)
        .await
        .expect("生成大纲失败");
    assert!(!outline_text.is_empty(), "大纲内容为空");
    step(&format!("大纲生成完成 ({} 字)", outline_text.len()), "ok");

    let outline = match files::parse_outline_text(&outline_text) {
        Ok(o) => o,
        Err(e) => {
            eprintln!("\n\x1b[31m大纲解析失败: {}\x1b[0m", e);
            eprintln!("\n--- AI 返回的大纲原文 ---\n{}", outline_text);
            panic!("大纲解析失败");
        }
    };
    if outline.is_empty() || outline.iter().all(|v| v.chapters.is_empty()) {
        eprintln!("\n\x1b[31m大纲结构为空\x1b[0m");
        eprintln!("\n--- AI 返回的大纲原文 ---\n{}", outline_text);
        panic!("大纲解析后没有有效的卷/章节");
    }
    files::write_outline(&dir, &outline).unwrap();
    step("大纲解析并保存成功", "ok");

    let total: u32 = outline.iter().map(|v| v.chapters.len() as u32).sum();
    assert!(total >= 5, "大纲章节数不足，期望 >= 5，实际 {}", total);
    step(&format!("大纲包含 {} 章", total), "ok");

    // ─── Step 5: 生成第一章 ───
    step("生成第 1 章...", "run");
    let chapter_title = files::get_chapter_outline(&dir, 1)
        .unwrap()
        .expect("第 1 章大纲缺失");
    step(&format!("章节标题: {}", chapter_title), "ok");

    let chapter_prompt = config::fill_template(
        &config.prompts.chapter,
        &[
            ("genre", "xuanhuan"),
            ("theme", "逆天改命"),
            ("intent_block", "当前核心张力：主角面临初次考验\n读者关注点：主角如何觉醒"),
            ("character_states", "- 暂无角色状态"),
            ("plot_events", "- 暂无"),
            ("tension_checklist", "- 暂无"),
            ("emotional_arc", "暂无"),
            ("num", "1"),
            ("title", &chapter_title),
            ("words", "1000"),
        ],
    );

    let content = novel_app_lib::ai::generate(&config, &chapter_prompt)
        .await
        .expect("生成章节失败");
    assert!(content.len() > 200, "章节内容过短");
    step(&format!("第 1 章生成完成 ({} 字)", content.len()), "ok");

    // 写入章节文件
    let ch_dir = files::chapters_dir(&dir);
    std::fs::create_dir_all(&ch_dir).unwrap();
    let safe_title: String = chapter_title.chars().take(10).collect();
    let filename = format!("001-{}.md", safe_title);

    use chrono::Local;
    let meta = files::ChapterMeta {
        chapter: 1,
        title: chapter_title.clone(),
        words: content.len() as u32,
        created: Local::now().format("%Y-%m-%d").to_string(),
    };
    let meta_yaml = serde_yaml::to_string(&meta).unwrap();
    let file_content = format!(
        "---\n{}---\n\n# 第1章 {}\n\n{}",
        meta_yaml, chapter_title, content
    );
    files::write_file_atomic(&ch_dir.join(&filename), &file_content).unwrap();
    step(&format!("章节文件已写入: {}", filename), "ok");

    // ─── Step 6: 验证文件结构 ───
    eprintln!("\n\x1b[1;36m━━━ 验证文件结构 ━━━\x1b[0m\n");

    assert!(dir.join("novel.md").exists(), "novel.md 不存在");
    step("novel.md 存在", "ok");

    assert!(dir.join("outline.md").exists(), "outline.md 不存在");
    step("outline.md 存在", "ok");

    assert!(dir.join("context.md").exists(), "context.md 不存在");
    step("context.md 存在", "ok");

    let chapters = files::list_chapters(&dir).unwrap();
    assert_eq!(chapters.len(), 1, "应有 1 个章节文件");
    step(&format!("chapters/ 包含 {} 个文件", chapters.len()), "ok");

    // 用实际文件名读取
    let actual_filename = first_chapter_filename(&dir);
    let (ch_meta, ch_body) = files::read_chapter(&dir, &actual_filename).unwrap();
    assert_eq!(ch_meta.chapter, 1);
    assert!(!ch_body.is_empty());
    step("章节文件读取正常", "ok");

    let status = novel::get_status(&dir).unwrap();
    assert_eq!(status.total_chapters, total);
    step(
        &format!(
            "最终状态: {} 卷 {} 章，已写 {} 章",
            status.outline.len(),
            status.total_chapters,
            status.written_chapters,
        ),
        "ok",
    );

    // 清理
    let _ = std::fs::remove_dir_all(&dir);

    eprintln!("\n\x1b[32m━━━ 全流程测试通过 ━━━\x1b[0m\n");
}

#[tokio::test]
#[ignore]
async fn ai_generate_smoke_test() {
    let api_key = std::env::var("NOVEL_API_KEY").expect("请设置 NOVEL_API_KEY");

    let config = AppConfig {
        provider: Provider::OpenAI,
        model: "deepseek-chat".to_string(),
        api_base_url: "https://api.deepseek.com".to_string(),
        api_key,
        timeout: 120,
        ..AppConfig::default()
    };

    let result = novel_app_lib::ai::generate(&config, "请用一句话回答：1+1等于几？")
        .await
        .expect("AI 调用失败");

    assert!(!result.is_empty(), "AI 返回为空");
    assert!(result.contains('2'), "AI 应该回答 2，实际: {}", result);
    step("AI 调用冒烟测试通过", "ok");
}

#[tokio::test]
#[ignore]
async fn ai_streaming_test() {
    let api_key = std::env::var("NOVEL_API_KEY").expect("请设置 NOVEL_API_KEY");

    let config = AppConfig {
        provider: Provider::OpenAI,
        model: "deepseek-chat".to_string(),
        api_base_url: "https://api.deepseek.com".to_string(),
        api_key,
        timeout: 120,
        ..AppConfig::default()
    };

    let chunks = AtomicU32::new(0);
    let result = novel_app_lib::ai::generate_streaming(&config, "用一句话描述春天", |_chunk| {
        chunks.fetch_add(1, Ordering::Relaxed);
        Ok(())
    })
    .await
    .expect("流式调用失败");

    let total_chunks = chunks.load(Ordering::Relaxed);
    assert!(!result.is_empty(), "流式结果为空");
    assert!(total_chunks > 1, "应有多个流式块，实际: {}", total_chunks);
    step(&format!("AI 流式调用测试通过 ({} 个块)", total_chunks), "ok");
}
