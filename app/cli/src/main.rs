mod commands;
mod config_io;

use std::process::ExitCode;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "autowrite-cli", version, about = "AutoWrite 小说生成命令行工具")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// 初始化小说项目（在指定目录创建 novel.md + 默认配置）
    Init(commands::InitArgs),
    /// 查看或设置配置（provider/model/api-key/ollama-url 等）
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
    /// 生成大纲（三步流式：世界观 → 角色 → 大纲）
    Outline(commands::OutlineArgs),
    /// 生成下一章（基于三层记忆）
    Chapter(commands::ChapterArgs),
    /// 查看小说进度（已写章节、总章节、当前叙事记忆摘要）
    Status(commands::DirArgs),
    /// 列出所有已写章节
    List(commands::DirArgs),
    /// 读取某章节正文
    Read(commands::ReadArgs),
    /// 直接与 AI 对话（不写文件，纯问答，验证连通性）
    Chat(commands::ChatArgs),
}

#[derive(Subcommand)]
enum ConfigAction {
    /// 查看配置（无参数打印全部，或指定单字段）
    Get {
        #[arg(default_value = "")]
        field: String,
    },
    /// 设置单字段
    Set {
        field: String,
        value: String,
    },
}

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse();
    match commands::run(cli.command).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("错误: {err}");
            ExitCode::FAILURE
        }
    }
}
