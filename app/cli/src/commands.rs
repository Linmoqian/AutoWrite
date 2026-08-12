use std::io::Write;
use std::path::PathBuf;

use clap::Args;

use autowrite_core::{
    create_novel, create_provider, generate_chapter_streaming, generate_outline_streaming_with_progress,
    get_status, list_chapters, read_chapter, AppConfig, OutlineStep, ProgressEvent, Provider,
};

use crate::config_io::{load_config, save_config};
use crate::ConfigAction;

type CmdResult = Result<(), Box<dyn std::error::Error>>;

// ===== 参数定义 =====

#[derive(Args)]
pub struct InitArgs {
    #[arg(long, default_value = ".")]
    pub dir: PathBuf,
    #[arg(long)]
    pub title: String,
    #[arg(long, default_value = "玄幻")]
    pub genre: String,
    #[arg(long, default_value = "成长")]
    pub theme: String,
    #[arg(long, default_value_t = 30)]
    pub chapters: u32,
    #[arg(long, help = "覆盖已有小说")]
    pub force: bool,
}

#[derive(Args)]
pub struct OutlineArgs {
    #[arg(long, default_value = ".")]
    pub dir: PathBuf,
    #[arg(long, help = "只跑某步：world | characters | outline（默认全跑）")]
    pub step: Option<String>,
}

#[derive(Args)]
pub struct ChapterArgs {
    #[arg(long, default_value = ".")]
    pub dir: PathBuf,
}

#[derive(Args)]
pub struct DirArgs {
    #[arg(long, default_value = ".")]
    pub dir: PathBuf,
}

#[derive(Args)]
pub struct ReadArgs {
    #[arg(long, default_value = ".")]
    pub dir: PathBuf,
    #[arg(long)]
    pub chapter: u32,
}

#[derive(Args)]
pub struct ChatArgs {
    #[arg(long)]
    pub prompt: String,
}

// ===== 命令分发 =====

pub async fn run(command: crate::Command) -> CmdResult {
    match command {
        crate::Command::Init(args) => cmd_init(args),
        crate::Command::Config { action } => cmd_config(action),
        crate::Command::Outline(args) => cmd_outline(args).await,
        crate::Command::Chapter(args) => cmd_chapter(args).await,
        crate::Command::Status(args) => cmd_status(args),
        crate::Command::List(args) => cmd_list(args),
        crate::Command::Read(args) => cmd_read(args),
        crate::Command::Chat(args) => cmd_chat(args).await,
    }
}

// ===== init =====

fn cmd_init(args: InitArgs) -> CmdResult {
    let config = load_config();
    // core 的 storage 层假设目录已存在，这里确保创建
    std::fs::create_dir_all(&args.dir)?;
    create_novel(
        &args.dir,
        &args.title,
        &args.genre,
        &args.theme,
        args.chapters,
        &config,
        args.force,
    )?;
    println!("已创建小说《{}》于 {}", args.title, args.dir.display());
    Ok(())
}

// ===== config =====

fn cmd_config(action: ConfigAction) -> CmdResult {
    match action {
        ConfigAction::Get { field } => {
            let config = load_config();
            if field.is_empty() {
                let yaml = serde_yaml::to_string(&config)?;
                print!("{yaml}");
            } else {
                print_config_field(&config, &field);
            }
        }
        ConfigAction::Set { field, value } => {
            let mut config = load_config();
            set_config_field(&mut config, &field, &value)?;
            save_config(&config)?;
            println!("已设置 {field} = {value}");
        }
    }
    Ok(())
}

fn print_config_field(config: &AppConfig, field: &str) {
    let value = match field {
        "provider" => format!("{:?}", config.provider).to_lowercase(),
        "model" => config.model.clone(),
        "api-key" => config.api_key.clone(),
        "api_base_url" => config.api_base_url.clone(),
        "ollama-url" => config.ollama_url.clone(),
        "ollama_model" => config.ollama_model.clone(),
        "ollama-model" => config.ollama_model.clone(),
        "num_ctx" => config.num_ctx.to_string(),
        "timeout" => config.timeout.to_string(),
        other => {
            eprintln!("未知字段: {other}");
            return;
        }
    };
    println!("{value}");
}

fn set_config_field(
    config: &mut AppConfig,
    field: &str,
    value: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    match field {
        "provider" => {
            config.provider = match value.to_lowercase().as_str() {
                "openai" | "deepseek" => Provider::OpenAI,
                "ollama" => Provider::Ollama,
                "claude" | "anthropic" => Provider::Claude,
                "gemini" | "google" => Provider::Gemini,
                "llamacpp" | "llama" | "llama-cpp" => Provider::LlamaCpp,
                _ => {
                    return Err(format!(
                        "无效 provider: {value}，可选 openai | ollama | claude | gemini | llamacpp"
                    )
                    .into())
                }
            };
        }
        "model" => config.model = value.to_string(),
        "api-key" => config.api_key = value.to_string(),
        "api_base_url" => config.api_base_url = value.to_string(),
        "ollama-url" | "ollama_url" => config.ollama_url = value.to_string(),
        "ollama_model" | "ollama-model" => config.ollama_model = value.to_string(),
        "num_ctx" => config.num_ctx = value.parse()?,
        "timeout" => config.timeout = value.parse()?,
        other => return Err(format!("未知字段: {other}").into()),
    }
    Ok(())
}

// ===== outline =====

async fn cmd_outline(args: OutlineArgs) -> CmdResult {
    let config = load_config();
    let target = args.step.as_deref().unwrap_or("");
    generate_outline_streaming_with_progress(&args.dir, &config, target, |ev| {
        handle_outline_event(ev);
    })
    .await?;
    println!("\n完成，已写入 outline.md");
    Ok(())
}

fn handle_outline_event(ev: ProgressEvent) {
    if let ProgressEvent::OutlineStep { step, chunk, done } = ev {
        if done {
            let label = step_label(&step);
            println!("\n[{label}] 完成");
        } else if chunk.is_empty() {
            let label = step_label(&step);
            print!("\n[{label}] 正在生成...\n");
            let _ = std::io::stdout().flush();
        } else {
            print!("{chunk}");
            let _ = std::io::stdout().flush();
        }
    }
}

fn step_label(step: &OutlineStep) -> &'static str {
    match step {
        OutlineStep::World => "世界观",
        OutlineStep::Characters => "角色",
        OutlineStep::Outline => "大纲",
    }
}

// ===== chapter =====

async fn cmd_chapter(args: ChapterArgs) -> CmdResult {
    let config = load_config();
    let chapter_num = generate_chapter_streaming(&args.dir, &config, |ev| {
        if let ProgressEvent::ChapterChunk { chunk, done } = ev {
            if done {
                println!();
            } else {
                print!("{chunk}");
                let _ = std::io::stdout().flush();
            }
        }
    })
    .await?;
    println!("已生成第 {chapter_num} 章");
    Ok(())
}

// ===== status =====

fn cmd_status(args: DirArgs) -> CmdResult {
    let status = get_status(&args.dir)?;
    let novel = &status.novel;
    println!("标题: {}", novel.title);
    println!("类型: {}", novel.genre);
    println!("主题: {}", novel.theme);
    println!("进度: 已写 {}/{} 章", status.written_chapters, novel.target_chapters);
    println!("目标模型: {}", novel.model);
    println!("创建于: {}", novel.created);

    if let Some(world) = &novel.world {
        println!("\n世界观（前 100 字）:");
        println!("{}", preview(world, 100));
    }
    if let Some(characters) = &novel.characters {
        println!("\n角色（前 100 字）:");
        println!("{}", preview(characters, 100));
    }

    println!("\n叙事记忆摘要:");
    let ctx = &status.context;
    if !ctx.recent_summaries.is_empty() {
        for s in &ctx.recent_summaries {
            println!("  - {s}");
        }
    } else {
        println!("  （暂无，生成章节后自动填充）");
    }

    Ok(())
}

fn preview(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let head: String = trimmed.chars().take(max_chars).collect();
    format!("{head}...")
}

// ===== list =====

fn cmd_list(args: DirArgs) -> CmdResult {
    let chapters = list_chapters(&args.dir)?;
    if chapters.is_empty() {
        println!("暂无已写章节");
        return Ok(());
    }
    println!("{:<6} {:<20} {:<8} 创建日期", "序号", "标题", "字数");
    println!("{}", "-".repeat(60));
    for ch in &chapters {
        println!(
            "{:<6} {:<20} {:<8} {}",
            ch.chapter, ch.title, ch.words, ch.created
        );
    }
    Ok(())
}

// ===== read =====

fn cmd_read(args: ReadArgs) -> CmdResult {
    let chapters = list_chapters(&args.dir)?;
    let target = chapters
        .iter()
        .find(|c| c.chapter == args.chapter)
        .ok_or_else(|| format!("未找到第 {} 章", args.chapter))?;

    let filename = format!("{:03}-{}.md", target.chapter, title_prefix(&target.title));
    let (meta, body) = read_chapter(&args.dir, &filename)?;
    println!("# 第{}章 {}\n", meta.chapter, meta.title);
    println!("{body}");
    Ok(())
}

fn title_prefix(title: &str) -> String {
    title.chars().take(10).collect()
}

// ===== chat =====

async fn cmd_chat(args: ChatArgs) -> CmdResult {
    let config = load_config();
    let provider = create_provider(&config);
    let reply = provider.generate(&config, &args.prompt).await?;
    println!("{reply}");
    Ok(())
}
