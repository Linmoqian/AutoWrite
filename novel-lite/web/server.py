"""Novel-Lite Web Dashboard 后端"""

import asyncio
import json
import sys
import time
from pathlib import Path

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
async def write_next(idx: int):
    novels = discover_novels()
    if idx < 0 or idx >= len(novels):
        raise HTTPException(404, "项目不存在")
    info = novels[idx]
    if info.current_chapter >= info.target_chapters:
        return {"success": False, "message": "已达到目标章数"}

    state = _get_state(idx)
    _log_broadcast(idx, "info", f"开始创作第 {info.current_chapter + 1} 章...")
    state.timer_start = time.monotonic()

    writer = ChapterWriter(info.path)
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
async def auto_start(idx: int):
    novels = discover_novels()
    if idx < 0 or idx >= len(novels):
        raise HTTPException(404, "项目不存在")

    state = _get_state(idx)
    if state.running:
        return {"success": False, "message": "已在自动创作中"}

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
        writer = ChapterWriter(info.path)
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
