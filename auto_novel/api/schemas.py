"""API 数据模型

提供 FastAPI 请求/响应的 Pydantic 模型定义。
字段命名使用 camelCase 以保持与前端 TypeScript 接口一致。
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# =============================================================================
# 枚举定义
# =============================================================================


class NovelStatus(str, Enum):
    """小说状态枚举

    与前端 kanban/src/types/index.ts NovelStatus 保持一致。
    """

    TODO = "todo"
    WRITING = "writing"
    REVIEWING = "reviewing"
    PUBLISHED = "published"


class WorkflowStatus(str, Enum):
    """工作流状态枚举

    细粒度的创作流程状态，与前端 WorkflowStatus 保持一致。
    """

    OUTLINE = "outline"
    OUTLINE_REVIEW = "outline_review"
    CHARACTER_DESIGN = "character_design"
    WRITING = "writing"
    AI_REVIEW = "ai_review"
    HUMAN_FINALIZATION = "human_finalization"
    PUBLISHED = "published"


class ChapterStatus(str, Enum):
    """章节状态枚举"""

    DRAFT = "draft"
    REVIEWING = "reviewing"
    FINALIZED = "finalized"


class CharacterRole(str, Enum):
    """角色类型枚举"""

    PROTAGONIST = "protagonist"
    ANTAGONIST = "antagonist"
    SUPPORTING = "supporting"
    MINOR = "minor"


# =============================================================================
# 请求模型
# =============================================================================


class NovelCreate(BaseModel):
    """创建小说请求"""

    title: str = Field(..., description="小说标题")
    genre: str = Field(..., description="类型: xuanhuan/dushi/yanqing/kehuan")
    theme: str = Field(..., description="主题，如修仙、都市爱情等")
    targetChapters: int = Field(default=100, ge=1, description="目标章节数")
    description: Optional[str] = Field(default=None, description="小说简介")


class NovelUpdate(BaseModel):
    """更新小说请求"""

    title: Optional[str] = Field(default=None, description="小说标题")
    genre: Optional[str] = Field(default=None, description="类型")
    theme: Optional[str] = Field(default=None, description="主题")
    targetChapters: Optional[int] = Field(default=None, ge=1, description="目标章节数")
    writtenChapters: Optional[int] = Field(default=None, ge=0, description="已写章节数")
    wordCount: Optional[int] = Field(default=None, ge=0, description="总字数")
    description: Optional[str] = Field(default=None, description="小说简介")
    status: Optional[NovelStatus] = Field(default=None, description="小说状态")
    workflowStatus: Optional[WorkflowStatus] = Field(default=None, description="工作流状态")
    outline: Optional[str] = Field(default=None, description="故事大纲")


class ChapterCreate(BaseModel):
    """创建章节请求"""

    number: int = Field(..., ge=1, description="章节序号")
    title: str = Field(..., description="章节标题")
    content: str = Field(default="", description="章节内容")
    status: ChapterStatus = Field(default=ChapterStatus.DRAFT, description="章节状态")


class ChapterUpdate(BaseModel):
    """更新章节请求"""

    title: Optional[str] = Field(default=None, description="章节标题")
    content: Optional[str] = Field(default=None, description="章节内容")
    status: Optional[ChapterStatus] = Field(default=None, description="章节状态")


class CharacterCreate(BaseModel):
    """创建角色请求"""

    name: str = Field(..., description="角色名称")
    role: CharacterRole = Field(..., description="角色类型")
    description: str = Field(default="", description="角色描述")
    traits: List[str] = Field(default_factory=list, description="角色特征列表")


class CharacterUpdate(BaseModel):
    """更新角色请求"""

    name: Optional[str] = Field(default=None, description="角色名称")
    role: Optional[CharacterRole] = Field(default=None, description="角色类型")
    description: Optional[str] = Field(default=None, description="角色描述")
    traits: Optional[List[str]] = Field(default=None, description="角色特征列表")


# =============================================================================
# 响应模型
# =============================================================================


class ChapterResponse(BaseModel):
    """章节响应"""

    id: str = Field(..., description="章节 ID")
    novelId: str = Field(..., description="所属小说 ID")
    number: int = Field(..., description="章节序号")
    title: str = Field(..., description="章节标题")
    content: str = Field(..., description="章节内容")
    wordCount: int = Field(..., ge=0, description="章节字数")
    status: ChapterStatus = Field(..., description="章节状态")
    createdAt: str = Field(..., description="创建时间 ISO 格式")
    updatedAt: str = Field(..., description="更新时间 ISO 格式")

    model_config = {"from_attributes": True}


class CharacterResponse(BaseModel):
    """角色响应"""

    id: str = Field(..., description="角色 ID")
    novelId: str = Field(..., description="所属小说 ID")
    name: str = Field(..., description="角色名称")
    role: CharacterRole = Field(..., description="角色类型")
    description: str = Field(..., description="角色描述")
    traits: List[str] = Field(default_factory=list, description="角色特征列表")

    model_config = {"from_attributes": True}


class NovelResponse(BaseModel):
    """小说基础响应"""

    id: str = Field(..., description="小说 ID")
    title: str = Field(..., description="小说标题")
    genre: str = Field(..., description="类型")
    theme: str = Field(..., description="主题")
    targetChapters: int = Field(..., ge=1, description="目标章节数")
    writtenChapters: int = Field(..., ge=0, description="已写章节数")
    status: NovelStatus = Field(..., description="小说状态")
    workflowStatus: WorkflowStatus = Field(..., description="工作流状态")
    outline: Optional[str] = Field(default=None, description="故事大纲")
    description: Optional[str] = Field(default=None, description="小说简介")
    createdAt: str = Field(..., description="创建时间 ISO 格式")
    updatedAt: str = Field(..., description="更新时间 ISO 格式")
    wordCount: int = Field(..., ge=0, description="总字数")

    model_config = {"from_attributes": True}


class NovelListResponse(BaseModel):
    """小说列表响应"""

    novels: List[NovelResponse] = Field(default_factory=list, description="小说列表")
    total: int = Field(..., ge=0, description="总数")


class NovelDetailResponse(NovelResponse):
    """小说详情响应

    继承 NovelResponse，额外包含章节和角色列表。
    """

    chapters: List[ChapterResponse] = Field(default_factory=list, description="章节列表")
    characters: List[CharacterResponse] = Field(default_factory=list, description="角色列表")


# =============================================================================
# Ollama 模型相关
# =============================================================================


class OllamaModelResponse(BaseModel):
    """Ollama 模型响应"""

    name: str = Field(..., description="模型名称")
    size: int = Field(..., ge=0, description="模型大小（字节）")
    digest: str = Field(..., description="模型摘要")
    modifiedAt: str = Field(..., description="最后修改时间 ISO 格式")


class OllamaModelListResponse(BaseModel):
    """Ollama 模型列表响应"""

    models: List[OllamaModelResponse] = Field(default_factory=list, description="模型列表")
    total: int = Field(..., ge=0, description="总数")


class OllamaHealthResponse(BaseModel):
    """Ollama 健康检查响应"""

    healthy: bool = Field(..., description="服务是否健康")
    host: str = Field(..., description="Ollama 服务地址")
