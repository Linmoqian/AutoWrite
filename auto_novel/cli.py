"""命令行界面"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from .agents.novel_manager import NovelManager
from .agents.novel_state import NovelState
from .scheduler.task_scheduler import TaskScheduler
from .scheduler.novel_job import NovelJob
from .publisher.fanqie_publisher import FanqiePublisher
from .models.ollama_client import OllamaClient

console = Console()


async def create_novel(args):
    """创建新小说"""
    console.print(Panel.fit(
        f"[bold cyan]创建新小说[/bold cyan]\n"
        f"标题: {args.title}\n"
        f"类型: {args.genre}\n"
        f"主题: {args.theme}",
        title="AI 小说创作系统"
    ))

    manager = NovelManager()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        # 创建小说
        task = progress.add_task("创建小说...", total=None)
        state = await manager.create_novel(
            title=args.title,
            genre=args.genre,
            theme=args.theme
        )

        # 构建世界观
        progress.update(task, description="构建世界观...")
        await manager.build_world(state)

        # 创建主角
        progress.update(task, description="创建主角...")
        await manager.create_main_character(state, args.character or "")

        # 生成大纲
        progress.update(task, description=f"生成 {args.chapters} 章大纲...")
        await manager.generate_outline(state, args.chapters)

    # 保存状态
    job = NovelJob(state, auto_publish=False)
    await job._save_state()

    # 显示结果
    console.print("\n[green]✓ 小说创建成功![/green]")
    console.print(f"  [cyan]ID:[/cyan] {state.id}")
    console.print(f"  [cyan]标题:[/cyan] {state.title}")
    console.print(f"  [cyan]类型:[/cyan] {state.genre}")
    console.print(f"  [cyan]大纲章节数:[/cyan] {len(state.outline)}")
    console.print(f"  [cyan]状态文件:[/cyan] data/novels/{state.id}/state.json")


async def write_chapter(args):
    """撰写章节"""
    # 加载小说状态
    state = NovelJob.load_state(args.novel_id)
    if not state:
        console.print(f"[red]✗ 小说不存在: {args.novel_id}[/red]")
        return

    console.print(f"[cyan]正在为《{state.title}》撰写第 {state.current_chapter + 1} 章...[/cyan]")

    job = NovelJob(state, auto_publish=args.publish)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("初始化...", total=None)
        await job.initialize()

        progress.update(task, description="撰写章节...")
        result = await job.write_next_chapter()

    # 显示结果
    console.print("\n[green]✓ 章节撰写完成![/green]")
    console.print(f"  [cyan]章节:[/cyan] 第 {result['chapter']} 章")
    console.print(f"  [cyan]标题:[/cyan] {result['title']}")
    console.print(f"  [cyan]字数:[/cyan] {result['word_count']}")
    if args.publish:
        status = "[green]已发布[/green]" if result['published'] else "[red]发布失败[/red]"
        console.print(f"  [cyan]发布状态:[/cyan] {status}")


async def list_novels(args):
    """列出所有小说"""
    novels_dir = Path("data/novels")
    if not novels_dir.exists():
        console.print("[yellow]还没有创建任何小说[/yellow]")
        return

    novels = list(novels_dir.iterdir())
    if not novels:
        console.print("[yellow]还没有创建任何小说[/yellow]")
        return

    table = Table(title="小说列表")
    table.add_column("ID", style="cyan")
    table.add_column("标题", style="green")
    table.add_column("类型", style="yellow")
    table.add_column("当前章节", justify="right")
    table.add_column("总字数", justify="right")

    for novel_dir in novels:
        state = NovelJob.load_state(novel_dir.name)
        if state:
            table.add_row(
                state.id,
                state.title,
                state.genre,
                str(state.current_chapter),
                f"{state.total_words:,}"
            )

    console.print(table)


async def show_novel(args):
    """显示小说详情"""
    state = NovelJob.load_state(args.novel_id)
    if not state:
        console.print(f"[red]✗ 小说不存在: {args.novel_id}[/red]")
        return

    console.print(Panel.fit(
        f"[bold green]{state.title}[/bold green]\n"
        f"ID: {state.id}\n"
        f"类型: {state.genre}\n"
        f"主题: {state.theme}\n"
        f"当前章节: {state.current_chapter} / {state.total_chapters_planned}\n"
        f"总字数: {state.total_words:,}",
        title="小说详情"
    ))

    if state.characters:
        console.print("\n[bold]角色:[/bold]")
        for char in state.characters:
            console.print(f"  • {char.name} ({char.role})")

    if args.show_outline and state.outline:
        console.print(f"\n[bold]大纲 (前 {min(10, len(state.outline))} 章):[/bold]")
        for i, item in enumerate(state.outline[:10], 1):
            console.print(f"  {i}. {item.get('title', '未命名')}")


async def start_daemon(args):
    """启动守护进程"""
    console.print(Panel.fit(
        "[bold cyan]启动自动化小说创作系统[/bold cyan]\n"
        f"配置文件: data/novels.json",
        title="守护进程"
    ))

    # 加载小说配置
    config_file = Path("data/novels.json")
    if not config_file.exists():
        console.print("[red]✗ 请先创建配置文件: data/novels.json[/red]")
        console.print("\n配置文件示例:")
        console.print('''[
  {
    "novel_id": "abc12345",
    "book_id": "番茄小说书籍ID",
    "auto_publish": true,
    "schedule": {"hour": 10, "minute": 0}
  }
]''')
        return

    with open(config_file, 'r', encoding='utf-8') as f:
        configs = json.load(f)

    scheduler = TaskScheduler()
    jobs_to_init = []

    for config in configs:
        novel_id = config.get("novel_id")
        if not novel_id:
            continue

        state = NovelJob.load_state(novel_id)
        if not state:
            console.print(f"[yellow]⚠ 跳过不存在的小说: {novel_id}[/yellow]")
            continue

        job = NovelJob(
            state,
            book_id=config.get("book_id"),
            auto_publish=config.get("auto_publish", True)
        )

        # 添加定时任务
        schedule = config.get("schedule", {"hour": 10, "minute": 0})
        scheduler.add_chapter_job(
            job_id=f"novel_{state.id}",
            func=job.write_next_chapter,
            hour=schedule.get("hour", 10),
            minute=schedule.get("minute", 0)
        )

        jobs_to_init.append(job)
        console.print(f"[green]✓ 已添加任务: {state.title} -> 每天 {schedule.get('hour', 10):02d}:{schedule.get('minute', 0):02d}[/green]")

    if not jobs_to_init:
        console.print("[red]✗ 没有有效的小说任务[/red]")
        return

    # 初始化所有任务
    console.print("\n[cyan]初始化任务...[/cyan]")
    for job in jobs_to_init:
        await job.initialize()

    # 启动调度器
    scheduler.start()
    console.print("\n[green]✓ 调度器已启动[/green]")
    console.print("[yellow]按 Ctrl+C 停止[/yellow]\n")

    # 显示任务列表
    table = Table(title="定时任务")
    table.add_column("任务ID", style="cyan")
    table.add_column("执行时间", style="green")
    for job_id, desc in scheduler.list_jobs().items():
        next_run = scheduler.get_next_run_time(job_id)
        table.add_row(job_id, f"{desc} (下次: {next_run or '未知'})")
    console.print(table)

    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        console.print("\n[yellow]正在停止...[/yellow]")
        scheduler.stop()
        # 清理资源
        for job in jobs_to_init:
            await job.cleanup()
        console.print("[green]✓ 系统已停止[/green]")


async def login_fanqie(args):
    """登录番茄小说"""
    console.print("[cyan]启动浏览器，请在浏览器中完成登录...[/cyan]")

    publisher = FanqiePublisher(headless=False)
    await publisher.start()

    success = await publisher.login("", "")  # 手动登录

    if success:
        console.print("[green]✓ 登录成功！Cookies 已保存[/green]")
    else:
        console.print("[red]✗ 登录失败或超时[/red]")

    await publisher.close()


async def check_ollama(args):
    """检查 Ollama 服务状态"""
    console.print("[cyan]检查 Ollama 服务...[/cyan]")

    client = OllamaClient()

    if await client.check_health():
        console.print("[green]✓ Ollama 服务正常运行[/green]")
        console.print(f"  地址: {client.host}")
        console.print(f"  模型: {client.model}")
    else:
        console.print("[red]✗ Ollama 服务未运行[/red]")
        console.print("\n请先启动 Ollama:")
        console.print("  brew install ollama")
        console.print("  ollama serve")
        console.print(f"  ollama pull {client.model}")


def main():
    """主入口"""
    parser = argparse.ArgumentParser(
        description="AI 小说自动化创作系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py create --title "我的小说" --genre xuanhuan --theme 修仙
  python main.py write --novel-id abc12345
  python main.py daemon
  python main.py login
        """
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # create 命令
    create_parser = subparsers.add_parser("create", help="创建新小说")
    create_parser.add_argument("--title", required=True, help="小说标题")
    create_parser.add_argument("--genre", default="xuanhuan",
                               choices=["xuanhuan", "dushi", "yanqing", "kehuan"],
                               help="小说类型 (default: xuanhuan)")
    create_parser.add_argument("--theme", default="修仙", help="主题")
    create_parser.add_argument("--character", default="", help="主角名字")
    create_parser.add_argument("--chapters", type=int, default=100, help="计划章节数")

    # write 命令
    write_parser = subparsers.add_parser("write", help="撰写章节")
    write_parser.add_argument("--novel-id", required=True, help="小说ID")
    write_parser.add_argument("--publish", action="store_true", help="自动发布到番茄小说")

    # list 命令
    list_parser = subparsers.add_parser("list", help="列出所有小说")

    # show 命令
    show_parser = subparsers.add_parser("show", help="显示小说详情")
    show_parser.add_argument("novel_id", help="小说ID")
    show_parser.add_argument("--show-outline", action="store_true", help="显示大纲")

    # daemon 命令
    subparsers.add_parser("daemon", help="启动守护进程 (24h 自动化)")

    # login 命令
    subparsers.add_parser("login", help="登录番茄小说")

    # check 命令
    subparsers.add_parser("check", help="检查 Ollama 服务状态")

    args = parser.parse_args()

    # 命令路由
    commands = {
        "create": create_novel,
        "write": write_chapter,
        "list": list_novels,
        "show": show_novel,
        "daemon": start_daemon,
        "login": login_fanqie,
        "check": check_ollama,
    }

    if args.command in commands:
        asyncio.run(commands[args.command](args))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
