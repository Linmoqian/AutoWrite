"""Novel-Lite TUI 终端仪表盘"""

import asyncio
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.widgets import (
    Button,
    Footer,
    Header,
    Label,
    ListItem,
    ListView,
    ProgressBar,
    RichLog,
    Static,
)
from textual import work

NOVEL_LITE_DIR = Path(__file__).parent.resolve()


# ── 数据读取 ──────────────────────────────────────────────


def _parse_yaml_front_matter(content: str) -> dict:
    """解析 YAML front matter"""
    if not content.startswith("---\n"):
        return {}
    parts = content.split("---\n", 2)
    if len(parts) < 3:
        return {}
    return yaml.safe_load(parts[1]) or {}


def _read_file(path: Path) -> str:
    """安全读取文件"""
    try:
        return path.read_text(encoding="utf-8") if path.exists() else ""
    except Exception:
        return ""


@dataclass
class NovelInfo:
    """项目信息聚合"""

    path: Path
    title: str = ""
    genre: str = ""
    theme: str = ""
    target_chapters: int = 0
    model: str = ""
    created: str = ""
    current_chapter: int = 0
    total_words: int = 0
    chapters: list = field(default_factory=list)

    @property
    def display_name(self) -> str:
        return self.title or self.path.name


class NovelReader:
    """独立解析 .md 文件，不 import files.py"""

    def __init__(self, project_dir: Path):
        self.dir = project_dir

    def read_novel_meta(self) -> dict:
        content = _read_file(self.dir / "novel.md")
        return _parse_yaml_front_matter(content)

    def read_progress(self) -> int:
        content = _read_file(self.dir / "context.md")
        for line in content.split("\n"):
            if "已完成：" in line:
                try:
                    return int(line.split("：")[1].replace("章", "").strip())
                except (ValueError, IndexError):
                    pass
        return 0

    def count_chapters(self) -> int:
        chapters_dir = self.dir / "chapters"
        if not chapters_dir.is_dir():
            return 0
        return sum(
            1
            for f in chapters_dir.iterdir()
            if f.suffix == ".md" and not f.name.endswith((".bak", ".tmp"))
        )

    def calc_total_words(self) -> int:
        chapters_dir = self.dir / "chapters"
        if not chapters_dir.is_dir():
            return 0
        total = 0
        for f in chapters_dir.iterdir():
            if f.suffix == ".md" and not f.name.endswith((".bak", ".tmp")):
                meta = _parse_yaml_front_matter(_read_file(f))
                total += meta.get("words", 0)
        return total

    def get_chapter_list(self) -> list[dict]:
        chapters_dir = self.dir / "chapters"
        if not chapters_dir.is_dir():
            return []
        result = []
        for f in sorted(chapters_dir.iterdir()):
            if f.suffix != ".md" or f.name.endswith((".bak", ".tmp")):
                continue
            meta = _parse_yaml_front_matter(_read_file(f))
            result.append(
                {
                    "num": meta.get("chapter", 0),
                    "title": meta.get("title", ""),
                    "words": meta.get("words", 0),
                    "created": meta.get("created", ""),
                }
            )
        return result

    def load(self) -> NovelInfo:
        meta = self.read_novel_meta()
        info = NovelInfo(
            path=self.dir,
            title=meta.get("title", ""),
            genre=meta.get("genre", ""),
            theme=meta.get("theme", ""),
            target_chapters=meta.get("target_chapters", 0),
            model=meta.get("model", ""),
            created=meta.get("created", ""),
        )
        info.current_chapter = self.read_progress()
        info.chapters = self.get_chapter_list()
        info.total_words = self.calc_total_words()
        return info


# ── 项目扫描 ──────────────────────────────────────────────

SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", "node_modules", ".venv", "venv"}


def discover_novels() -> list[NovelInfo]:
    """扫描含 novel.md 的项目目录"""
    novels: list[NovelInfo] = []
    seen: set[Path] = set()
    search_roots = [NOVEL_LITE_DIR, NOVEL_LITE_DIR.parent]

    for root in search_roots:
        _scan_recursive(root, novels, seen, depth=0, max_depth=3)

    return novels


def _scan_recursive(
    dir_path: Path, results: list[NovelInfo], seen: set[Path], depth: int, max_depth: int
) -> None:
    if depth > max_depth:
        return
    try:
        entries = list(dir_path.iterdir())
    except PermissionError:
        return

    if (dir_path / "novel.md").is_file() and dir_path not in seen:
        seen.add(dir_path)
        try:
            info = NovelReader(dir_path).load()
            results.append(info)
        except Exception:
            pass
        return

    for entry in entries:
        if entry.is_dir() and entry.name not in SKIP_DIRS and not entry.name.startswith("."):
            _scan_recursive(entry, results, seen, depth + 1, max_depth)


# ── Subprocess 写操作 ────────────────────────────────────


class ChapterWriter:
    """通过 subprocess 调用 write.py，不 import core.py"""

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir

    async def write_next(self, timeout: int = 600) -> tuple[bool, str]:
        write_py = str(NOVEL_LITE_DIR / "write.py")
        cmd = [sys.executable, write_py, "write"]
        env = {
            **os.environ,
            "PYTHONPATH": str(NOVEL_LITE_DIR),
        }
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(self.project_dir),
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
                output = stdout.decode("utf-8", errors="replace").strip()
                return proc.returncode == 0, output
            except asyncio.TimeoutError:
                proc.kill()
                return False, "创作超时"
        except Exception as e:
            return False, str(e)


# ── 计时器 ────────────────────────────────────────────────


class ElapsedTimer:
    """运行计时器"""

    def __init__(self) -> None:
        self._start: float | None = None
        self._elapsed: float = 0
        self.session_chapters: int = 0

    def start(self) -> None:
        if self._start is None:
            self._start = time.monotonic()

    def stop(self) -> None:
        if self._start is not None:
            self._elapsed += time.monotonic() - self._start
            self._start = None

    def elapsed(self) -> str:
        total = self._elapsed
        if self._start is not None:
            total += time.monotonic() - self._start
        h, rem = divmod(int(total), 3600)
        m, s = divmod(rem, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"


# ── TUI 主应用 ────────────────────────────────────────────


class NovelDashboard(App):
    """Novel-Lite 终端仪表盘"""

    TITLE = "Novel-Lite Dashboard"

    CSS_PATH = "tui.tcss"

    BINDINGS = [
        Binding("q", "quit", "退出"),
        Binding("r", "refresh", "刷新"),
        Binding("n", "write_next", "创作下一章"),
        Binding("a", "toggle_auto", "自动创作"),
        Binding("s", "stop_auto", "停止"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.novels: list[NovelInfo] = []
        self.current_index: int = -1
        self.timer = ElapsedTimer()
        self.auto_running = False

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)

        with Horizontal():
            # 侧边栏
            with Vertical(id="sidebar"):
                yield Label("📚 项目列表", id="sidebar-header")
                yield ListView(id="novel-list")

            # 主区域
            with Vertical(id="main-area"):
                yield Static("请选择一个项目", id="book-info")
                with Vertical(id="progress-section"):
                    yield ProgressBar(total=100, show_percentage=True, id="progress-bar")
                    yield Label("0 / 0", id="progress-label")
                with Horizontal(id="stats-row"):
                    yield Label("总字数: 0", classes="stat-item", id="stat-words")
                    yield Label("状态: 空闲", classes="stat-item", id="stat-status")
                with Horizontal(id="button-row"):
                    yield Button("📖 创作下一章", id="btn-write", variant="primary")
                    yield Button("🔄 自动创作", id="btn-auto", variant="success")
                    yield Button("⏹ 停止", id="btn-stop", variant="error", disabled=True)
                    yield Button("🔃 刷新", id="btn-refresh", variant="default")

                with VerticalScroll(id="log-area"):
                    yield RichLog(id="log", highlight=True, markup=True)

        with Horizontal(id="status-bar"):
            yield Label("模型: ", id="status-model")
            yield Label(" | 运行: 00:00:00", id="status-elapsed")
            yield Label(" | 本会话: 0章", id="status-session")

        yield Footer()

    def on_mount(self) -> None:
        self._refresh_data()
        self.set_interval(1, self._update_status_bar)

    # ── 数据刷新 ──────────────────────────────────────

    def _refresh_data(self) -> None:
        """重新扫描项目并刷新面板"""
        self.novels = discover_novels()
        self._rebuild_list()

        if self.current_index >= len(self.novels):
            self.current_index = len(self.novels) - 1

        if self.novels and self.current_index >= 0:
            self._update_main_panel()
        else:
            self.query_one("#book-info", Static).update(
                "[dim]未发现小说项目\n请先使用 python write.py new 创建[/]"
            )
            self.query_one("#progress-bar", ProgressBar).update(total=100, progress=0)
            self.query_one("#progress-label", Label).update("0 / 0")

    def _rebuild_list(self) -> None:
        """重建项目列表"""
        list_view = self.query_one("#novel-list", ListView)
        list_view.clear()

        for info in self.novels:
            label_text = f"● {info.display_name}\n  [dim]{info.current_chapter}/{info.target_chapters}[/]"
            list_view.append(ListItem(Label(label_text, classes="listitem-label")))

    def _update_main_panel(self) -> None:
        """更新主面板数据"""
        if self.current_index < 0 or self.current_index >= len(self.novels):
            return

        info = self.novels[self.current_index]

        # 书籍信息
        book_text = (
            f"[bold]{info.display_name}[/]\n"
            f"[dim]类型:[/] {info.genre}  [dim]主题:[/] {info.theme}\n"
            f"[dim]模型:[/] {info.model}  [dim]创建日期:[/] {info.created}"
        )
        self.query_one("#book-info", Static).update(book_text)

        # 进度条
        total = max(info.target_chapters, 1)
        done = info.current_chapter
        progress_pct = int(done / total * 100)
        bar = self.query_one("#progress-bar", ProgressBar)
        bar.update(total=100, progress=progress_pct)
        self.query_one("#progress-label", Label).update(f"{done} / {info.target_chapters}")

        # 统计
        self.query_one("#stat-words", Label).update(f"总字数: {info.total_words:,}")
        self.query_one("#stat-status", Label).update(
            f"状态: {'已完成' if done >= info.target_chapters else '创作中'}"
        )

        # 模型
        self.query_one("#status-model", Label).update(f"模型: {info.model or '-'}")

    def _update_status_bar(self) -> None:
        """每秒刷新状态栏"""
        self.query_one("#status-elapsed", Label).update(
            f" | 运行: {self.timer.elapsed()}"
        )
        self.query_one("#status-session", Label).update(
            f" | 本会话: {self.timer.session_chapters}章"
        )

    # ── 事件处理 ──────────────────────────────────────

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        """切换选中项目"""
        items = self.query("#novel-list ListItem")
        for i, item in enumerate(items):
            if item == event.item:
                self.current_index = i
                break
        self._update_main_panel()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn_id = event.button.id
        if btn_id == "btn-write":
            self.action_write_next()
        elif btn_id == "btn-auto":
            self.action_toggle_auto()
        elif btn_id == "btn-stop":
            self.action_stop_auto()
        elif btn_id == "btn-refresh":
            self.action_refresh()

    # ── 创作操作 ──────────────────────────────────────

    @work(exclusive=True)
    async def action_write_next(self) -> None:
        """创作下一章"""
        if self.current_index < 0 or self.current_index >= len(self.novels):
            self._log("[red]请先选择一个项目[/]")
            return

        info = self.novels[self.current_index]
        if info.current_chapter >= info.target_chapters:
            self._log("[yellow]已达到目标章数，无需继续创作[/]")
            return

        writer = ChapterWriter(info.path)
        self._log(f"[cyan]开始创作第 {info.current_chapter + 1} 章...[/]")
        self._set_buttons_writing(True)
        self.timer.start()

        success, output = await writer.write_next()

        if success:
            self.timer.session_chapters += 1
        self._set_buttons_writing(False)

        if success:
            self._log(f"[green]第 {info.current_chapter + 1} 章创作完成[/]")
            if output:
                for line in output.split("\n")[-5:]:
                    self._log(f"  [dim]{line}[/]")
        else:
            self._log(f"[red]创作失败: {output}[/]")

        self.action_refresh()

    def action_toggle_auto(self) -> None:
        """启动/停止自动创作"""
        if self.auto_running:
            self.action_stop_auto()
        else:
            self.auto_running = True
            self._log("[green]自动创作模式已启动[/]")
            self.query_one("#btn-auto", Button).label = "⏸ 暂停"
            self.query_one("#btn-stop", Button).disabled = False
            self.auto_write_loop()

    def action_stop_auto(self) -> None:
        """停止自动创作"""
        self.auto_running = False
        self.workers.cancel_group(self, "auto_write")
        self._log("[yellow]自动创作已停止[/]")
        self.query_one("#btn-auto", Button).label = "🔄 自动创作"
        self.query_one("#btn-stop", Button).disabled = True
        self.timer.stop()

    @work(group="auto_write", exclusive=True)
    async def auto_write_loop(self) -> None:
        """循环创作直到目标章数"""
        fail_count = 0

        while self.auto_running:
            if self.current_index < 0 or self.current_index >= len(self.novels):
                self._log("[red]无有效项目，自动创作停止[/]")
                break

            info = self.novels[self.current_index]
            if info.current_chapter >= info.target_chapters:
                self._log(f"[green]《{info.display_name}》已创作完成[/]")
                break

            writer = ChapterWriter(info.path)
            self._log(f"[cyan][自动] 开始创作第 {info.current_chapter + 1} 章...[/]")
            success, output = await writer.write_next()

            if success:
                fail_count = 0
                self.timer.session_chapters += 1
                self._log(f"[green][自动] 第 {info.current_chapter + 1} 章完成[/]")
                self.action_refresh()
            else:
                fail_count += 1
                self._log(
                    f"[red][自动] 失败 ({fail_count}/3): {output}[/]"
                )
                if fail_count >= 3:
                    self._log("[red]连续失败 3 次，自动创作暂停[/]")
                    break
                self._log("[yellow]30 秒后重试...[/]")
                await asyncio.sleep(30)

        self.auto_running = False
        self.call_from_thread(self._reset_auto_ui)

    def action_refresh(self) -> None:
        """重新扫描项目并刷新面板"""
        self._refresh_data()
        self._log("[blue]数据已刷新[/]")

    # ── 辅助方法 ──────────────────────────────────────

    def _log(self, message: str) -> None:
        log = self.query_one("#log", RichLog)
        log.write(message)

    def _set_buttons_writing(self, writing: bool) -> None:
        self.query_one("#btn-write", Button).disabled = writing

    def _reset_auto_ui(self) -> None:
        self.auto_running = False
        try:
            self.query_one("#btn-auto", Button).label = "🔄 自动创作"
            self.query_one("#btn-stop", Button).disabled = True
        except Exception:
            pass


if __name__ == "__main__":
    app = NovelDashboard()
    app.run()
