"""FastAPI 路由定义"""

from typing import List

from fastapi import APIRouter, HTTPException, status

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
)

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
