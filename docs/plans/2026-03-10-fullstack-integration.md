# 前后端对接实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现看板前端与 Python 后端的完整对接，支持小说 CRUD、章节管理、角色管理，数据持久化到本地 JSON 文件。

**Architecture:**
- 后端：FastAPI 提供 REST API，复用现有 NovelManager/NovelState 逻辑
- 前端：Next.js 通过 fetch 调用后端 API，移除 localStorage 依赖
- 数据存储：JSON 文件持久化到 data/novels/ 目录

**Tech Stack:** FastAPI, Pydantic, Next.js 16, TypeScript, Tailwind CSS 4

---

## Phase 1: 后端 API 层

### Task 1: 安装 FastAPI 依赖

**Files:**
- Modify: `requirements.txt` 或 `environment.yml`

**Step 1: 添加依赖**

```bash
# 在 environment.yml 中添加
pip install fastapi uvicorn
```

**Step 2: 验证安装**

```bash
pip install fastapi uvicorn
# 确认安装成功
```

**Step 3: 提交**

```bash
git add environment.yml
git commit -feat(api): 添加 FastAPI 依赖"
```

---

### Task 2: 创建 API 数据模型

**Files:**
- Create: `auto_novel/api/__init__.py`
- Create: `auto_novel/api/schemas.py`

**Step 1: 创建 API 目录**

```python
# auto_novel/api/__init__.py
"""API 模块"""
```

**Step 2: 创建 Pydantic 模型**

```python
# auto_novel/api/schemas.py
"""API 数据模型"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum


class NovelStatus(str, Enum):
    TODO = "todo"
    WRITING = "writing"
    REVIEWING = "reviewing"
    PUBLISHED = "published"


class WorkflowStatus(str, Enum):
    OUTLINE = "outline"
    OUTLINE_REVIEW = "outline_review"
    CHARACTER_DESIGN = "character_design"
    WRITING = "writing"
    AI_REVIEW = "ai_review"
    HUMAN_FINALIZATION = "human_finalization"
    PUBLISHED = "published"


class ChapterStatus(str, Enum):
    DRAFT = "draft"
    REVIEWING = "reviewing"
    FINALIZED = "finalized"


class CharacterRole(str, Enum):
    PROTAGONIST = "protagonist"
    ANTAGONIST = "antagonist"
    SUPPORTING = "supporting"
    MINOR = "minor"


# 请求模型
class NovelCreate(BaseModel):
    title: str
    genre: str
    theme: str
    targetChapters: int = 100
    description: Optional[str] = None


class NovelUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[str] = None
    theme: Optional[str] = None
    targetChapters: Optional[int] = None
    writtenChapters: Optional[int] = None
    wordCount: Optional[int] = None
    description: Optional[str] = None
    status: Optional[NovelStatus] = None
    workflowStatus: Optional[WorkflowStatus] = None
    outline: Optional[str] = None


class ChapterCreate(BaseModel):
    number: int
    title: str
    content: str = ""
    status: ChapterStatus = ChapterStatus.DRAFT


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[ChapterStatus] = None


class CharacterCreate(BaseModel):
    name: str
    role: CharacterRole
    description: str = ""
    traits: List[str] = []


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[CharacterRole] = None
    description: Optional[str] = None
    traits: Optional[List[str]] = None


# 响应模型
class ChapterResponse(BaseModel):
    id: str
    novelId: str
    number: int
    title: str
    content: str
    wordCount: int
    status: ChapterStatus
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


class CharacterResponse(BaseModel):
    id: str
    novelId: str
    name: str
    role: CharacterRole
    description: str
    traits: List[str]

    class Config:
        from_attributes = True


class NovelResponse(BaseModel):
    id: str
    title: str
    genre: str
    theme: str
    targetChapters: int
    writtenChapters: int
    status: NovelStatus
    workflowStatus: WorkflowStatus
    outline: Optional[str] = None
    description: Optional[str] = None
    createdAt: str
    updatedAt: str
    wordCount: int

    class Config:
        from_attributes = True


class NovelListResponse(BaseModel):
    novels: List[NovelResponse]
    total: int


class NovelDetailResponse(NovelResponse):
    chapters: List[ChapterResponse] = []
    characters: List[CharacterResponse] = []
```

**Step 3: 提交**

```bash
git add auto_novel/api/
git commit -m "feat(api): 创建 Pydantic 数据模型"
```

---

### Task 3: 创建数据存储服务

**Files:**
- Create: `auto_novel/api/storage.py`

**Step 1: 创建存储服务**

```python
# auto_novel/api/storage.py
"""数据存储服务 - JSON 文件持久化"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

DATA_DIR = Path("data/novels")


def ensure_data_dir():
    """确保数据目录存在"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_novel_path(novel_id: str) -> Path:
    """获取小说数据文件路径"""
    return DATA_DIR / novel_id / "state.json"


def list_novels() -> List[Dict[str, Any]]:
    """列出所有小说"""
    ensure_data_dir()
    novels = []
    for novel_dir in DATA_DIR.iterdir():
        if novel_dir.is_dir():
            state_file = novel_dir / "state.json"
            if state_file.exists():
                with open(state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    novels.append(data)
    return novels


def get_novel(novel_id: str) -> Optional[Dict[str, Any]]:
    """获取单个小说"""
    path = get_novel_path(novel_id)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_novel(novel_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """保存小说数据"""
    ensure_data_dir()
    novel_dir = DATA_DIR / novel_id
    novel_dir.mkdir(parents=True, exist_ok=True)

    data["updatedAt"] = datetime.now().isoformat()

    path = novel_dir / "state.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return data


def create_novel(data: Dict[str, Any]) -> Dict[str, Any]:
    """创建新小说"""
    novel_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    novel = {
        "id": novel_id,
        "title": data["title"],
        "genre": data["genre"],
        "theme": data["theme"],
        "targetChapters": data.get("targetChapters", 100),
        "writtenChapters": 0,
        "wordCount": 0,
        "status": "todo",
        "workflowStatus": "outline",
        "outline": None,
        "description": data.get("description"),
        "createdAt": now,
        "updatedAt": now,
        "chapters": [],
        "characters": [],
    }

    return save_novel(novel_id, novel)


def delete_novel(novel_id: str) -> bool:
    """删除小说"""
    path = get_novel_path(novel_id)
    if not path.exists():
        return False

    novel_dir = DATA_DIR / novel_id
    import shutil
    shutil.rmtree(novel_dir)
    return True


# 章节管理
def add_chapter(novel_id: str, chapter_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """添加章节"""
    novel = get_novel(novel_id)
    if not novel:
        return None

    chapter_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    chapter = {
        "id": chapter_id,
        "novelId": novel_id,
        "number": chapter_data["number"],
        "title": chapter_data["title"],
        "content": chapter_data.get("content", ""),
        "wordCount": len(chapter_data.get("content", "")),
        "status": chapter_data.get("status", "draft"),
        "createdAt": now,
        "updatedAt": now,
    }

    novel["chapters"].append(chapter)
    novel["writtenChapters"] = len(novel["chapters"])
    novel["wordCount"] = sum(c["wordCount"] for c in novel["chapters"])

    save_novel(novel_id, novel)
    return chapter


def update_chapter(novel_id: str, chapter_id: str, chapter_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """更新章节"""
    novel = get_novel(novel_id)
    if not novel:
        return None

    for chapter in novel["chapters"]:
        if chapter["id"] == chapter_id:
            chapter.update(chapter_data)
            chapter["updatedAt"] = datetime.now().isoformat()
            if "content" in chapter_data:
                chapter["wordCount"] = len(chapter_data["content"])
            novel["wordCount"] = sum(c["wordCount"] for c in novel["chapters"])
            save_novel(novel_id, novel)
            return chapter

    return None


def delete_chapter(novel_id: str, chapter_id: str) -> bool:
    """删除章节"""
    novel = get_novel(novel_id)
    if not novel:
        return False

    original_len = len(novel["chapters"])
    novel["chapters"] = [c for c in novel["chapters"] if c["id"] != chapter_id]

    if len(novel["chapters"]) == original_len:
        return False

    novel["writtenChapters"] = len(novel["chapters"])
    novel["wordCount"] = sum(c["wordCount"] for c in novel["chapters"])
    save_novel(novel_id, novel)
    return True


# 角色管理
def add_character(novel_id: str, character_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """添加角色"""
    novel = get_novel(novel_id)
    if not novel:
        return None

    character_id = str(uuid.uuid4())[:8]

    character = {
        "id": character_id,
        "novelId": novel_id,
        "name": character_data["name"],
        "role": character_data.get("role", "supporting"),
        "description": character_data.get("description", ""),
        "traits": character_data.get("traits", []),
    }

    novel.setdefault("characters", []).append(character)
    save_novel(novel_id, novel)
    return character


def update_character(novel_id: str, character_id: str, character_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """更新角色"""
    novel = get_novel(novel_id)
    if not novel:
        return None

    for character in novel.get("characters", []):
        if character["id"] == character_id:
            character.update(character_data)
            save_novel(novel_id, novel)
            return character

    return None


def delete_character(novel_id: str, character_id: str) -> bool:
    """删除角色"""
    novel = get_novel(novel_id)
    if not novel:
        return False

    original_len = len(novel.get("characters", []))
    novel["characters"] = [c for c in novel.get("characters", []) if c["id"] != character_id]

    if len(novel["characters"]) == original_len:
        return False

    save_novel(novel_id, novel)
    return True
```

**Step 2: 提交**

```bash
git add auto_novel/api/storage.py
git commit -m "feat(api): 创建 JSON 文件存储服务"
```

---

### Task 4: 创建 FastAPI 路由

**Files:**
- Create: `auto_novel/api/routes.py`

**Step 1: 创建 API 路由**

```python
# auto_novel/api/routes.py
"""FastAPI 路由定义"""

from typing import List
from fastapi import APIRouter, HTTPException, status

from .schemas import (
    NovelCreate, NovelUpdate, NovelResponse, NovelListResponse, NovelDetailResponse,
    ChapterCreate, ChapterUpdate, ChapterResponse,
    CharacterCreate, CharacterUpdate, CharacterResponse,
)
from . import storage

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


@router.post("/novels/{novel_id}/chapters", response_model=ChapterResponse, status_code=status.HTTP_201_CREATED)
async def create_chapter(novel_id: str, chapter: ChapterCreate):
    """创建章节"""
    result = storage.add_chapter(novel_id, chapter.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="小说不存在")
    return ChapterResponse(**result)


@router.patch("/novels/{novel_id}/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(novel_id: str, chapter_id: str, chapter: ChapterUpdate):
    """更新章节"""
    result = storage.update_chapter(novel_id, chapter_id, chapter.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="章节不存在")
    return ChapterResponse(**result)


@router.delete("/novels/{novel_id}/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.post("/novels/{novel_id}/characters", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED)
async def create_character(novel_id: str, character: CharacterCreate):
    """创建角色"""
    result = storage.add_character(novel_id, character.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="小说不存在")
    return CharacterResponse(**result)


@router.patch("/novels/{novel_id}/characters/{character_id}", response_model=CharacterResponse)
async def update_character(novel_id: str, character_id: str, character: CharacterUpdate):
    """更新角色"""
    result = storage.update_character(novel_id, character_id, character.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="角色不存在")
    return CharacterResponse(**result)


@router.delete("/novels/{novel_id}/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(novel_id: str, character_id: str):
    """删除角色"""
    if not storage.delete_character(novel_id, character_id):
        raise HTTPException(status_code=404, detail="角色不存在")
```

**Step 2: 提交**

```bash
git add auto_novel/api/routes.py
git commit -m "feat(api): 创建 FastAPI 路由"
```

---

### Task 5: 创建 FastAPI 应用入口

**Files:**
- Create: `auto_novel/api/app.py`

**Step 1: 创建应用入口**

```python
# auto_novel/api/app.py
"""FastAPI 应用入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router

app = FastAPI(
    title="AI 小说自动化 API",
    description="小说创作管理 API",
    version="1.0.0",
)

# CORS 配置 - 允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    """健康检查"""
    return {"status": "ok", "message": "AI 小说 API 运行中"}


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "healthy"}
```

**Step 2: 提交**

```bash
git add auto_novel/api/app.py
git commit -m "feat(api): 创建 FastAPI 应用入口"
```

---

### Task 6: 创建启动脚本

**Files:**
- Create: `run_api.py`

**Step 1: 创建启动脚本**

```python
#!/usr/bin/env python3
"""启动 API 服务器"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "auto_novel.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
```

**Step 2: 测试 API**

```bash
# 启动后端
python run_api.py

# 在另一个终端测试
curl http://localhost:8000/health
# 期望: {"status":"healthy"}
```

**Step 3: 提交**

```bash
git add run_api.py
git commit -m "feat(api): 添加 API 启动脚本"
```

---

## Phase 2: 前端 API 集成

### Task 7: 创建 API 客户端

**Files:**
- Create: `kanban/src/lib/api.ts`

**Step 1: 创建 API 客户端**

```typescript
// kanban/src/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// 通用请求函数
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || '请求失败');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ===== 类型定义 =====
export interface Novel {
  id: string;
  title: string;
  genre: string;
  theme: string;
  targetChapters: number;
  writtenChapters: number;
  status: 'todo' | 'writing' | 'reviewing' | 'published';
  workflowStatus: string;
  outline?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
}

export interface Chapter {
  id: string;
  novelId: string;
  number: number;
  title: string;
  content: string;
  wordCount: number;
  status: 'draft' | 'reviewing' | 'finalized';
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  novelId: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  traits: string[];
}

// ===== 小说 API =====
export const novelApi = {
  list: () => request<{ novels: Novel[]; total: number }>('/novels'),

  get: (id: string) =>
    request<Novel & { chapters: Chapter[]; characters: Character[] }>(`/novels/${id}`),

  create: (data: Partial<Novel>) =>
    request<Novel>('/novels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Novel>) =>
    request<Novel>(`/novels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/novels/${id}`, { method: 'DELETE' }),
};

// ===== 章节 API =====
export const chapterApi = {
  list: (novelId: string) =>
    request<Chapter[]>(`/novels/${novelId}/chapters`),

  create: (novelId: string, data: Partial<Chapter>) =>
    request<Chapter>(`/novels/${novelId}/chapters`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (novelId: string, chapterId: string, data: Partial<Chapter>) =>
    request<Chapter>(`/novels/${novelId}/chapters/${chapterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (novelId: string, chapterId: string) =>
    request<void>(`/novels/${novelId}/chapters/${chapterId}`, { method: 'DELETE' }),
};

// ===== 角色 API =====
export const characterApi = {
  list: (novelId: string) =>
    request<Character[]>(`/novels/${novelId}/characters`),

  create: (novelId: string, data: Partial<Character>) =>
    request<Character>(`/novels/${novelId}/characters`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (novelId: string, characterId: string, data: Partial<Character>) =>
    request<Character>(`/novels/${novelId}/characters/${characterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (novelId: string, characterId: string) =>
    request<void>(`/novels/${novelId}/characters/${characterId}`, { method: 'DELETE' }),
};
```

**Step 2: 提交**

```bash
git add kanban/src/lib/api.ts
git commit -m "feat(kanban): 创建 API 客户端"
```

---

### Task 8: 更新 Store 使用 API

**Files:**
- Modify: `kanban/src/store/kanbanStore.ts`

**Step 1: 修改 Store**

移除 persist 中间件，改为直接调用 API：

```typescript
// kanban/src/store/kanbanStore.ts
import { create } from 'zustand';
import type { KanbanState, Chapter, Character, Novel } from '@/types';
import { novelApi, chapterApi, characterApi } from '@/lib/api';

export const useKanbanStore = create<KanbanState>()((set, get) => ({
  novels: [],
  chapters: [],
  characters: [],
  searchQuery: '',
  selectedGenre: null,
  isLoading: false,

  // 加载数据
  loadNovels: async () => {
    try {
      const { novels } = await novelApi.list();
      set({ novels });
    } catch (error) {
      console.error('加载小说列表失败:', error);
    }
  },

  setNovels: (novels) => set({ novels }),

  moveNovel: async (novelId, newStatus) => {
    const novel = get().novels.find((n) => n.id === novelId);
    if (!novel) return;

    set((state) => ({
      novels: state.novels.map((n) =>
        n.id === novelId
          ? { ...n, status: newStatus, updatedAt: new Date().toISOString() }
          : n
      ),
    }));

    try {
      await novelApi.update(novelId, { status: newStatus });
    } catch (error) {
      console.error('更新状态失败:', error);
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedGenre: (genre) => set({ selectedGenre: genre }),

  addNovel: async (novel) => {
    try {
      const created = await novelApi.create({
        title: novel.title,
        genre: novel.genre,
        theme: novel.theme,
        targetChapters: novel.targetChapters,
        description: novel.description,
      });
      set((state) => ({ novels: [...state.novels, created] }));
    } catch (error) {
      console.error('创建小说失败:', error);
    }
  },

  updateNovel: async (novel) => {
    set((state) => ({
      novels: state.novels.map((n) => (n.id === novel.id ? novel : n)),
    }));

    try {
      await novelApi.update(novel.id, {
        title: novel.title,
        genre: novel.genre,
        theme: novel.theme,
        targetChapters: novel.targetChapters,
        writtenChapters: novel.writtenChapters,
        wordCount: novel.wordCount,
        description: novel.description,
      });
    } catch (error) {
      console.error('更新小说失败:', error);
    }
  },

  deleteNovel: async (novelId) => {
    set((state) => ({
      novels: state.novels.filter((n) => n.id !== novelId),
    }));

    try {
      await novelApi.delete(novelId);
    } catch (error) {
      console.error('删除小说失败:', error);
    }
  },

  // 章节管理
  addChapter: async (chapter: Chapter) => {
    try {
      const created = await chapterApi.create(chapter.novelId, {
        number: chapter.number,
        title: chapter.title,
        content: chapter.content,
        status: chapter.status,
      });
      set((state) => ({ chapters: [...state.chapters, created] }));
    } catch (error) {
      console.error('创建章节失败:', error);
    }
  },

  updateChapter: async (chapter: Chapter) => {
    set((state) => ({
      chapters: state.chapters.map((c) => (c.id === chapter.id ? chapter : c)),
    }));

    try {
      await chapterApi.update(chapter.novelId, chapter.id, {
        title: chapter.title,
        content: chapter.content,
        status: chapter.status,
      });
    } catch (error) {
      console.error('更新章节失败:', error);
    }
  },

  deleteChapter: async (chapterId: string) => {
    const chapter = get().chapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    set((state) => ({
      chapters: state.chapters.filter((c) => c.id !== chapterId),
    }));

    try {
      await chapterApi.delete(chapter.novelId, chapterId);
    } catch (error) {
      console.error('删除章节失败:', error);
    }
  },

  getChaptersByNovelId: (novelId: string) => {
    return get().chapters.filter((c) => c.novelId === novelId);
  },

  loadChapters: async (novelId: string) => {
    try {
      const chapters = await chapterApi.list(novelId);
      set((state) => ({
        chapters: [...state.chapters.filter((c) => c.novelId !== novelId), ...chapters],
      }));
    } catch (error) {
      console.error('加载章节失败:', error);
    }
  },

  // 角色管理
  addCharacter: async (character: Character) => {
    try {
      const created = await characterApi.create(character.novelId, {
        name: character.name,
        role: character.role,
        description: character.description,
        traits: character.traits,
      });
      set((state) => ({ characters: [...state.characters, created] }));
    } catch (error) {
      console.error('创建角色失败:', error);
    }
  },

  updateCharacter: async (character: Character) => {
    set((state) => ({
      characters: state.characters.map((c) =>
        c.id === character.id ? character : c
      ),
    }));

    try {
      await characterApi.update(character.novelId, character.id, {
        name: character.name,
        role: character.role,
        description: character.description,
        traits: character.traits,
      });
    } catch (error) {
      console.error('更新角色失败:', error);
    }
  },

  deleteCharacter: async (characterId: string) => {
    const character = get().characters.find((c) => c.id === characterId);
    if (!character) return;

    set((state) => ({
      characters: state.characters.filter((c) => c.id !== characterId),
    }));

    try {
      await characterApi.delete(character.novelId, characterId);
    } catch (error) {
      console.error('删除角色失败:', error);
    }
  },

  getCharactersByNovelId: (novelId: string) => {
    return get().characters.filter((c) => c.novelId === novelId);
  },

  loadCharacters: async (novelId: string) => {
    try {
      const characters = await characterApi.list(novelId);
      set((state) => ({
        characters: [...state.characters.filter((c) => c.novelId !== novelId), ...characters],
      }));
    } catch (error) {
      console.error('加载角色失败:', error);
    }
  },

  // 小说扩展方法
  updateNovelWorkflowStatus: async (novelId: string, status) => {
    set((state) => ({
      novels: state.novels.map((n) =>
        n.id === novelId
          ? { ...n, workflowStatus: status, updatedAt: new Date().toISOString() }
          : n
      ),
    }));

    try {
      await novelApi.update(novelId, { workflowStatus: status } as any);
    } catch (error) {
      console.error('更新工作流状态失败:', error);
    }
  },

  updateNovelOutline: async (novelId: string, outline: string) => {
    set((state) => ({
      novels: state.novels.map((n) =>
        n.id === novelId
          ? { ...n, outline, updatedAt: new Date().toISOString() }
          : n
      ),
    }));

    try {
      await novelApi.update(novelId, { outline } as any);
    } catch (error) {
      console.error('更新大纲失败:', error);
    }
  },
}));
```

**Step 2: 更新类型定义**

```typescript
// 在 kanban/src/types/index.ts 中添加
export interface KanbanState {
  novels: Novel[];
  chapters: Chapter[];
  characters: Character[];
  searchQuery: string;
  selectedGenre: string | null;
  isLoading?: boolean;

  // 加载数据
  loadNovels: () => Promise<void>;
  loadChapters: (novelId: string) => Promise<void>;
  loadCharacters: (novelId: string) => Promise<void>;

  // ... 其他现有方法改为 async
}
```

**Step 3: 提交**

```bash
git add kanban/src/store/kanbanStore.ts kanban/src/types/index.ts
git commit -m "feat(kanban): Store 改用 API 调用"
```

---

### Task 9: 更新主页面初始化数据

**Files:**
- Modify: `kanban/src/app/page.tsx`

**Step 1: 添加数据加载**

```typescript
// kanban/src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { KanbanBoard } from "@/components";
import { useKanbanStore } from "@/store";

export default function Home() {
  const loadNovels = useKanbanStore((state) => state.loadNovels);

  useEffect(() => {
    loadNovels();
  }, [loadNovels]);

  return (
    <main className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">小说创作看板</h1>
        <p className="text-slate-400 mt-1">管理你的 AI 小说创作进度</p>
      </header>
      <KanbanBoard />
    </main>
  );
}
```

**Step 2: 提交**

```bash
git add kanban/src/app/page.tsx
git commit -m "feat(kanban): 主页面加载 API 数据"
```

---

## Phase 3: 集成测试

### Task 10: 端到端测试

**Step 1: 启动后端**

```bash
python run_api.py
# 确认运行在 http://localhost:8000
```

**Step 2: 启动前端**

```bash
cd kanban && npm run dev
# 确认运行在 http://localhost:3000
```

**Step 3: 测试功能**

- [ ] 访问 http://localhost:3000
- [ ] 创建新小说
- [ ] 编辑小说
- [ ] 拖拽卡片改变状态
- [ ] 删除小说
- [ ] 查看小说详情
- [ ] 添加/编辑/删除章节
- [ ] 添加/编辑/删除角色

**Step 4: 提交**

```bash
git add -A
git commit -m "test: 前后端集成测试通过"
```

---

### Task 11: 更新文档

**Files:**
- Modify: `CLAUDE.md`

**Step 1: 更新文档**

在 CLAUDE.md 中添加 API 相关内容：

```markdown
### 常用命令

```bash
# 启动后端 API
python run_api.py

# 启动前端开发服务器
cd kanban && npm run dev

# 同时启动前后端
python run_api.py & cd kanban && npm run dev
```

### API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/novels` | GET | 获取小说列表 |
| `/api/novels` | POST | 创建小说 |
| `/api/novels/{id}` | GET | 获取小说详情 |
| `/api/novels/{id}` | PATCH | 更新小说 |
| `/api/novels/{id}` | DELETE | 删除小说 |
| `/api/novels/{id}/chapters` | GET/POST | 章节 CRUD |
| `/api/novels/{id}/characters` | GET/POST | 角色 CRUD |
```

**Step 2: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: 更新 API 文档"
```

---

### Task 12: 最终构建验证

**Step 1: 前端构建**

```bash
cd kanban && npm run build
# 确认构建成功
```

**Step 2: 最终提交**

```bash
git add -A
git commit -m "feat: 完成前后端对接"
```

---

## 文件结构总览

```
auto_novel/api/
├── __init__.py
├── app.py          # FastAPI 应用入口
├── routes.py       # API 路由
├── schemas.py      # Pydantic 模型
└── storage.py      # JSON 存储服务

kanban/src/
├── lib/
│   └── api.ts      # API 客户端
├── store/
│   └── kanbanStore.ts  # 状态管理（调用 API）
└── app/
    └── page.tsx    # 主页面

run_api.py          # API 启动脚本
```

---

## 测试清单

- [ ] 后端 API 启动正常
- [ ] 前端启动正常
- [ ] 创建小说
- [ ] 编辑小说
- [ ] 删除小说
- [ ] 拖拽改变状态
- [ ] 章节管理
- [ ] 角色管理
- [ ] 前端构建成功
