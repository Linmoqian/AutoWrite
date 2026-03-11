"""FastAPI 路由定义"""

import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from . import storage
from .schemas import (
    CharacterCreate,
    CharacterResponse,
    CharacterUpdate,
    ChapterCreate,
    ChapterResponse,
    ChapterUpdate,
    NovelCreate,
    NovelDetailResponse,
    NovelListResponse,
    NovelResponse,
    NovelUpdate,
    OllamaModelResponse,
    OllamaModelListResponse,
    OllamaHealthResponse,
)
from ..models.ollama_client import OllamaClient
from ..config import get_ollama_host
from pydantic import BaseModel

router = APIRouter()


# ===== 小说 CRUD =====


@router.get("/novels", response_model=NovelListResponse)
async def list_novels():
    """获取小说列表"""
    novels = storage.list_novels()
    return NovelListResponse(novels=novels, total=len(novels))


@router.post("/novels", response_model=NovelResponse, status_code=status.HTTP_201_CREATED)
async def create_novel(novel: NovelCreate):
    """创建小说"""
    data = storage.create_novel(novel.model_dump())
    return NovelResponse(**data)


@router.get("/novels/{novel_id}", response_model=NovelDetailResponse)
async def get_novel(novel_id: str):
    """获取小说详情"""
    novel = storage.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")
    return NovelDetailResponse(**novel)


@router.patch("/novels/{novel_id}", response_model=NovelResponse)
async def update_novel(novel_id: str, novel: NovelUpdate):
    """更新小说"""
    existing = storage.get_novel(novel_id)
    if not existing:
        raise HTTPException(status_code=404, detail="小说不存在")

    update_data = novel.model_dump(exclude_unset=True)
    existing.update(update_data)
    updated = storage.save_novel(novel_id, existing)
    return NovelResponse(**updated)


@router.delete("/novels/{novel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_novel(novel_id: str):
    """删除小说"""
    if not storage.delete_novel(novel_id):
        raise HTTPException(status_code=404, detail="小说不存在")


# ===== 章节管理 =====


@router.get("/novels/{novel_id}/chapters", response_model=List[ChapterResponse])
async def list_chapters(novel_id: str):
    """获取章节列表"""
    novel = storage.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")
    return [ChapterResponse(**c) for c in novel.get("chapters", [])]


@router.post(
    "/novels/{novel_id}/chapters",
    response_model=ChapterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_chapter(novel_id: str, chapter: ChapterCreate):
    """创建章节"""
    result = storage.add_chapter(novel_id, chapter.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="小说不存在")
    return ChapterResponse(**result)


@router.patch(
    "/novels/{novel_id}/chapters/{chapter_id}", response_model=ChapterResponse
)
async def update_chapter(novel_id: str, chapter_id: str, chapter: ChapterUpdate):
    """更新章节"""
    result = storage.update_chapter(
        novel_id, chapter_id, chapter.model_dump(exclude_unset=True)
    )
    if not result:
        raise HTTPException(status_code=404, detail="章节不存在")
    return ChapterResponse(**result)


@router.delete(
    "/novels/{novel_id}/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_chapter(novel_id: str, chapter_id: str):
    """删除章节"""
    if not storage.delete_chapter(novel_id, chapter_id):
        raise HTTPException(status_code=404, detail="章节不存在")


# ===== 角色管理 =====


@router.get("/novels/{novel_id}/characters", response_model=List[CharacterResponse])
async def list_characters(novel_id: str):
    """获取角色列表"""
    novel = storage.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="小说不存在")
    return [CharacterResponse(**c) for c in novel.get("characters", [])]


@router.post(
    "/novels/{novel_id}/characters",
    response_model=CharacterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_character(novel_id: str, character: CharacterCreate):
    """创建角色"""
    result = storage.add_character(novel_id, character.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="小说不存在")
    return CharacterResponse(**result)


@router.patch(
    "/novels/{novel_id}/characters/{character_id}", response_model=CharacterResponse
)
async def update_character(novel_id: str, character_id: str, character: CharacterUpdate):
    """更新角色"""
    result = storage.update_character(
        novel_id, character_id, character.model_dump(exclude_unset=True)
    )
    if not result:
        raise HTTPException(status_code=404, detail="角色不存在")
    return CharacterResponse(**result)


@router.delete(
    "/novels/{novel_id}/characters/{character_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_character(novel_id: str, character_id: str):
    """删除角色"""
    if not storage.delete_character(novel_id, character_id):
        raise HTTPException(status_code=404, detail="角色不存在")


# ===== AI 写作 =====


class WriteRequest(BaseModel):
    """写作请求"""
    prompt: str
    system: str = "你是资深玄幻小说作家。擅长写修仙题材。"
    novel_id: str
    chapter_num: int
    model: Optional[str] = None  # 可选的模型名称


@router.post("/write/stream")
async def write_stream(request: dict):
    """流式写作接口

    使用 SSE (Server-Sent Events) 返回流式生成的内容

    事件类型:
        - thinking: 思考过程内容
        - content: 生成的响应内容
        - done: 完成事件
        - error: 错误事件
    """
    prompt = request.get("prompt", "")
    system = request.get("system", "你是资深玄幻小说作家。")
    novel_id = request.get("novel_id", "")
    chapter_num = request.get("chapter_num", 1)
    model = request.get("model")  # 获取可选的模型参数

    if not prompt:
        raise HTTPException(status_code=400, detail="prompt 不能为空")

    # 如果指定了模型，使用指定的模型，否则使用默认配置
    from ..models.ollama_client import OllamaConfig
    config = OllamaConfig(model=model) if model else OllamaConfig()
    client = OllamaClient(config=config)

    async def generate():
        """生成器函数，流式输出内容"""
        try:
            async for chunk_data in client.generate_stream(prompt, system):
                # chunk_data 是 Dict[str, Any]，包含 {content, thinking, done}
                content = chunk_data.get("content", "")
                thinking = chunk_data.get("thinking", "")
                done = chunk_data.get("done", False)

                # 分别发送 thinking 和 content 事件
                if thinking:
                    yield {
                        "event": "thinking",
                        "data": json.dumps({"content": thinking}, ensure_ascii=False)
                    }
                if content:
                    yield {
                        "event": "content",
                        "data": json.dumps({"content": content}, ensure_ascii=False)
                    }

                # 发送完成事件
                if done:
                    yield {
                        "event": "done",
                        "data": json.dumps({
                            "content": "",
                            "done": True,
                            "novelId": novel_id,
                            "chapterNum": chapter_num
                        }, ensure_ascii=False)
                    }
                    return
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}, ensure_ascii=False)
            }

    return EventSourceResponse(generate())


# ===== Ollama 模型管理 =====


@router.get("/ollama/health", response_model=OllamaHealthResponse)
async def check_ollama_health():
    """检查 Ollama 服务健康状态"""
    from .ollama import OllamaModelManager

    manager = OllamaModelManager()
    healthy = await manager.check_service_health()

    return OllamaHealthResponse(healthy=healthy, host=manager.host)


@router.get("/ollama/models", response_model=OllamaModelListResponse)
async def list_ollama_models():
    """获取 Ollama 模型列表"""
    from .ollama import OllamaModelManager

    manager = OllamaModelManager()
    try:
        models = await manager.list_models()
        model_responses = [
            OllamaModelResponse(
                name=m.name,
                size=m.size,
                digest=m.digest,
                modifiedAt=m.modified_at,
            )
            for m in models
        ]
        return OllamaModelListResponse(models=model_responses, total=len(model_responses))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama 服务不可用: {e}")


@router.get("/ollama/models/thinking", response_model=OllamaModelListResponse)
async def list_thinking_models():
    """获取支持思考的模型列表"""
    from .ollama import OllamaModelManager

    manager = OllamaModelManager()
    try:
        models = await manager.get_thinking_capable_models()
        model_responses = [
            OllamaModelResponse(
                name=m.name,
                size=m.size,
                digest=m.digest,
                modifiedAt=m.modified_at,
            )
            for m in models
        ]
        return OllamaModelListResponse(models=model_responses, total=len(model_responses))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama 服务不可用: {e}")
