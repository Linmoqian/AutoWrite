"""API 数据模型"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class NovelStatus:
    """小说状态"""

    TODO = "todo"
    WRITING = "writing"
    REVIEWING = "reviewing"
    PUBLISHED = "published"


class WorkflowStatus:
    """工作流状态"""

    OUTLINE = "outline"
    OUTLINE_REVIEW = "outline_review"
    CHARACTER_DESIGN = "character_design"
    WRITING = "writing"
    AI_REVIEW = "ai_review"
    HUMAN_FINALIZATION = "human_finalization"
    PUBLISHED = "published"


class ChapterStatus:
    """章节状态"""

    DRAFT = "draft"
    REVIEWING = "reviewing"
    FINALIZED = "finalized"


class CharacterRole:
    """角色类型"""

    PROTAGONIST = "protagonist"
    ANTAGONIST = "antagonist"
    SUPPORTING = "supporting"
    MINOR = "minor"


# 请求模型
class NovelCreate(BaseModel):
    """创建小说请求"""

    title: str
    genre: str
    theme: str
    targetChapters: int = 100
    description: Optional[str] = None


class NovelUpdate(BaseModel):
    """更新小说请求"""

    title: Optional[str] = None
    genre: Optional[str] = None
    theme: Optional[str] = None
    targetChapters: Optional[int] = None
    writtenChapters: Optional[int] = None
    wordCount: Optional[int] = None
    description: Optional[str] = None
    status: Optional[str] = None
    workflowStatus: Optional[str] = None
    outline: Optional[str] = None


class ChapterCreate(BaseModel):
    """创建章节请求"""

    number: int
    title: str
    content: str = ""
    status: str = ChapterStatus.DRAFT


class ChapterUpdate(BaseModel):
    """更新章节请求"""

    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None


class CharacterCreate(BaseModel):
    """创建角色请求"""

    name: str
    role: str
    description: str = ""
    traits: List[str] = []


class CharacterUpdate(BaseModel):
    """更新角色请求"""

    name: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    traits: Optional[List[str]] = None


# 响应模型
class ChapterResponse(BaseModel):
    """章节响应"""

    id: str
    novelId: str
    number: int
    title: str
    content: str
    wordCount: int
    status: str
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


class CharacterResponse(BaseModel):
    """角色响应"""

    id: str
    novelId: str
    name: str
    role: str
    description: str
    traits: List[str]

    class Config:
        from_attributes = True


class NovelResponse(BaseModel):
    """小说响应"""

    id: str
    title: str
    genre: str
    theme: str
    targetChapters: int
    writtenChapters: int
    status: str
    workflowStatus: str
    outline: Optional[str] = None
    description: Optional[str] = None
    createdAt: str
    updatedAt: str
    wordCount: int

    class Config:
        from_attributes = True


class NovelListResponse(BaseModel):
    """小说列表响应"""

    novels: List[NovelResponse]
    total: int


class NovelDetailResponse(NovelResponse):
    """小说详情响应"""

    chapters: List[ChapterResponse] = []
    characters: List[CharacterResponse] = []
