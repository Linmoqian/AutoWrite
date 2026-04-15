"""Novel-Lite Web Dashboard 后端"""

import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import yaml

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# 复用 tui.py 数据层
NOVEL_LITE_DIR = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(NOVEL_LITE_DIR))

from tui import ChapterWriter, NovelReader, discover_novels  # noqa: E402

app = FastAPI(title="Novel-Lite Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 全局状态 ─────────────────────────────────────────────


class AutoState:
    """每个项目的自动创作状态"""

    def __init__(self):
        self.running = False
        self.task: asyncio.Task | None = None
        self.timer_start: float | None = None
        self.elapsed: float = 0
        self.session_chapters: int = 0
        self.model: str | None = None
        self.queues: list[asyncio.Queue] = []


auto_states: dict[int, AutoState] = {}


def _get_state(idx: int) -> AutoState:
    if idx not in auto_states:
        auto_states[idx] = AutoState()
    return auto_states[idx]


def _novel_list():
    novels = discover_novels()
    result = []
    for i, info in enumerate(novels):
        result.append(
            {
                "index": i,
                "title": info.display_name,
                "genre": info.genre,
                "theme": info.theme,
                "target_chapters": info.target_chapters,
                "current_chapter": info.current_chapter,
                "total_words": info.total_words,
                "model": info.model,
                "created": info.created,
            }
        )
    return result


def _parse_yaml_front_matter(content: str) -> dict:
    if not content.startswith("---\n"):
        return {}
    parts = content.split("---\n", 2)
    if len(parts) < 3:
        return {}
    return yaml.safe_load(parts[1]) or {}


def _read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8") if path.exists() else ""
    except Exception:
        return ""


def _read_chapter_content(project_dir: Path, chapter_num: int) -> dict | None:
    chapters_dir = project_dir / "chapters"
    if not chapters_dir.is_dir():
        return None
    for f in chapters_dir.iterdir():
        if f.suffix != ".md" or f.name.endswith((".bak", ".tmp")):
            continue
        content = _read_file(f)
        meta = _parse_yaml_front_matter(content)
        if meta.get("chapter") == chapter_num:
            body = content.split("---\n", 2)
            body_text = body[2].strip() if len(body) >= 3 else content
            return {
                "num": chapter_num,
                "title": meta.get("title", ""),
                "words": meta.get("words", 0),
                "created": meta.get("created", ""),
                "body": body_text,
            }
    return None


def _log_broadcast(idx: int, level: str, message: str):
    entry = {
        "timestamp": time.strftime("%H:%M:%S"),
        "level": level,
        "message": message,
    }
    state = auto_states.get(idx)
    if state:
        dead = []
        for q in state.queues:
            try:
                q.put_nowait(entry)
            except Exception:
                dead.append(q)
        for q in dead:
            state.queues.remove(q)


# ── API 端点 ─────────────────────────────────────────────


class WriteRequest(BaseModel):
    model: str | None = None


@app.get("/api/ollama/status")
def ollama_status():
    """检查 Ollama 连通性并返回可用模型列表"""
    try:
        import ollama

        models = [m.model for m in ollama.list().models]
        from config import CONFIG

        default_model = CONFIG.get("model", "")
        return {
            "connected": True,
            "models": sorted(models),
            "default": default_model,
        }
    except Exception as e:
        return {
            "connected": False,
            "models": [],
            "default": "",
            "error": str(e),
        }


@app.get("/api/novels")
def list_novels():
    return _novel_list()


@app.get("/api/novels/{idx}")
def get_novel(idx: int):
    novels = discover_novels()
    if idx < 0 or idx >= len(novels):
        raise HTTPException(404, "项目不存在")
    info = novels[idx]
    return {
        "index": idx,
        "title": info.display_name,
        "genre": info.genre,
        "theme": info.theme,
        "target_chapters": info.target_chapters,
        "current_chapter": info.current_chapter,
        "total_words": info.total_words,
        "model": info.model,
        "created": info.created,
        "path": str(info.path),
    }


@app.get("/api/novels/{idx}/chapters")
def get_chapters(idx: int):
    novels = discover_novels()
    if idx < 0 or idx >= len(novels):
        raise HTTPException(404, "项目不存在")
    reader = NovelReader(novels[idx].path)
    return reader.get_chapter_list()


@app.post("/api/novels/{idx}/write")
async def write_next(idx: int, req: WriteRequest | None = None):
    novels = discover_novels()
    if idx < 0 or idx >= len(novels):
        raise HTTPException(404, "项目不存在")
    info = novels[idx]
    if info.current_chapter >= info.target_chapters:
        return {"success": False, "message": "已达到目标章数"}

    model = req.model if req else None
    state = _get_state(idx)
    _log_broadcast(idx, "info", f"开始创作第 {info.current_chapter + 1} 章...")
    state.timer_start = time.monotonic()

    writer = ChapterWriter(info.path, model=model)
    success, output = await writer.write_next()

    if state.timer_start:
        state.elapsed += time.monotonic() - state.timer_start
        state.timer_start = None

    if success:
        state.session_chapters += 1
        _log_broadcast(idx, "success", f"第 {info.current_chapter + 1} 章创作完成")
    else:
        _log_broadcast(idx, "error", f"创作失败: {output}")

    return {"success": success, "message": output if not success else "创作完成"}


@app.post("/api/novels/{idx}/auto-start")
async def auto_start(idx: int, req: WriteRequest | None = None):
    novels = discover_novels()
    if idx < 0 or idx >= len(novels):
        raise HTTPException(404, "项目不存在")

    state = _get_state(idx)
    if state.running:
        return {"success": False, "message": "已在自动创作中"}

    model = req.model if req else None
    state.model = model
    state.running = True
    state.timer_start = time.monotonic()
    _log_broadcast(idx, "info", "自动创作模式已启动")

    state.task = asyncio.create_task(_auto_write_loop(idx))
    return {"success": True, "message": "自动创作已启动"}


@app.post("/api/novels/{idx}/auto-stop")
async def auto_stop(idx: int):
    state = auto_states.get(idx)
    if not state or not state.running:
        return {"success": False, "message": "未在自动创作中"}

    state.running = False
    if state.task:
        state.task.cancel()
        state.task = None
    if state.timer_start:
        state.elapsed += time.monotonic() - state.timer_start
        state.timer_start = None

    _log_broadcast(idx, "warning", "自动创作已停止")
    return {"success": True, "message": "已停止"}


async def _auto_write_loop(idx: int):
    state = _get_state(idx)
    fail_count = 0

    while state.running:
        novels = discover_novels()
        if idx >= len(novels):
            _log_broadcast(idx, "error", "项目不存在，自动创作停止")
            break

        info = novels[idx]
        if info.current_chapter >= info.target_chapters:
            _log_broadcast(idx, "success", f"《{info.display_name}》已创作完成")
            break

        _log_broadcast(idx, "info", f"[自动] 开始创作第 {info.current_chapter + 1} 章...")
        writer = ChapterWriter(info.path, model=state.model)
        success, output = await writer.write_next()

        if success:
            fail_count = 0
            state.session_chapters += 1
            _log_broadcast(idx, "success", f"[自动] 第 {info.current_chapter + 1} 章完成")
        else:
            fail_count += 1
            _log_broadcast(idx, "error", f"[自动] 失败 ({fail_count}/3): {output}")
            if fail_count >= 3:
                _log_broadcast(idx, "error", "连续失败 3 次，自动创作暂停")
                break
            _log_broadcast(idx, "warning", "30 秒后重试...")
            try:
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                break

    state.running = False


@app.get("/api/novels/{idx}/logs")
async def stream_logs(idx: int):
    state = _get_state(idx)
    queue: asyncio.Queue = asyncio.Queue()
    state.queues.append(queue)

    async def event_stream():
        try:
            while True:
                try:
                    entry = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(entry, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield f": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if queue in state.queues:
                state.queues.remove(queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class StatusResponse(BaseModel):
    model: str
    elapsed: str
    session_chapters: int
    auto_running: bool


class CreateNovelRequest(BaseModel):
    title: str
    genre: str = "xuanhuan"
    theme: str = "修仙"
    target_chapters: int = 100
    words_per_chapter: int = 3000
    model: str | None = None


class ChapterContentResponse(BaseModel):
    num: int
    title: str
    words: int
    created: str
    body: str


GENRES = [
    {"value": "xuanhuan", "label": "玄幻"},
    {"value": "qihuan", "label": "奇幻"},
    {"value": "wuxia", "label": "武侠"},
    {"value": "xianxia", "label": "仙侠"},
    {"value": "dushi", "label": "都市"},
    {"value": "lishi", "label": "历史"},
    {"value": "junshi", "label": "军事"},
    {"value": "kehuan", "label": "科幻"},
    {"value": "lingyi", "label": "灵异"},
    {"value": "youxi", "label": "游戏"},
    {"value": "jingji", "label": "竞技"},
    {"value": "tongren", "label": "同人"},
]


@app.post("/api/novels")
async def create_novel(req: CreateNovelRequest):
    import re

    safe_name = re.sub(r'[\\/:*?"<>|]', '_', req.title.strip())
    project_dir = NOVEL_LITE_DIR / safe_name
    project_dir.mkdir(parents=True, exist_ok=True)

    write_py = str(NOVEL_LITE_DIR / "write.py")
    cmd = [
        sys.executable, write_py, "new", req.title,
        "--genre", req.genre,
        "--theme", req.theme,
        "--chapters", str(req.target_chapters),
    ]
    env = {**os.environ, "PYTHONPATH": str(NOVEL_LITE_DIR)}
    if req.model:
        env["OLLAMA_MODEL"] = req.model
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(project_dir),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        if proc.returncode != 0:
            return {"success": False, "message": stdout.decode("utf-8", errors="replace").strip()}
    except asyncio.TimeoutError:
        proc.kill()
        return {"success": False, "message": "创建超时"}
    except Exception as e:
        return {"success": False, "message": str(e)}

    if req.words_per_chapter != 3000:
        novel_md = project_dir / "novel.md"
        if novel_md.exists():
            content = novel_md.read_text(encoding="utf-8")
            content = content.replace(
                "words_per_chapter: 3000",
                f"words_per_chapter: {req.words_per_chapter}",
            )
            novel_md.write_text(content, encoding="utf-8")

    novels = discover_novels()
    new_idx = -1
    for i, info in enumerate(novels):
        if info.path == project_dir:
            new_idx = i
            break

    return {"success": True, "index": new_idx, "message": f"《{req.title}》创建成功"}


@app.get("/api/novels/{idx}/chapters/{num}")
def get_chapter_content(idx: int, num: int):
    novels = discover_novels()
    if idx < 0 or idx >= len(novels):
        raise HTTPException(404, "项目不存在")
    result = _read_chapter_content(novels[idx].path, num)
    if result is None:
        raise HTTPException(404, "章节不存在")
    return ChapterContentResponse(**result)


@app.get("/api/genres")
def get_genres():
    return GENRES


@app.get("/api/status")
def global_status():
    novels = discover_novels()
    model = novels[0].model if novels else ""

    total_elapsed = 0
    total_session = 0
    any_running = False
    for state in auto_states.values():
        total_elapsed += state.elapsed
        if state.timer_start:
            total_elapsed += time.monotonic() - state.timer_start
        total_session += state.session_chapters
        if state.running:
            any_running = True

    h, rem = divmod(int(total_elapsed), 3600)
    m, s = divmod(rem, 60)

    return StatusResponse(
        model=model,
        elapsed=f"{h:02d}:{m:02d}:{s:02d}",
        session_chapters=total_session,
        auto_running=any_running,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
