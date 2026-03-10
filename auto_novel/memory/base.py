# auto_novel/memory/base.py
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum


class CompressionLevel(str, Enum):
    """压缩级别"""
    FULL = "full"       # 完整数据
    SUMMARY = "summary" # 摘要
    KEYWORDS = "keywords"  # 关键词


@dataclass
class WorldIndex:
    """世界观索引 - 轻量级元数据"""
    name: str
    genre: str
    theme: str
    keywords: List[str] = field(default_factory=list)
    element_tags: List[str] = field(default_factory=list)
    location_count: int = 0
    character_count: int = 0
    power_system_exists: bool = False


@dataclass
class CharacterIndex:
    """角色索引 - 快速检索"""
    id: str
    name: str
    role: str
    tags: List[str] = field(default_factory=list)
    first_appearance: int = 0  # 首次出现章节
    last_appearance: int = 0
    importance: float = 0.0  # 0-1 重要性评分


@dataclass
class ChapterIndex:
    """章节索引 - 元数据"""
    number: int
    title: str
    summary: str  # 100-200字摘要
    word_count: int
    characters: List[str] = field(default_factory=list)  # 出场角色ID
    locations: List[str] = field(default_factory=list)   # 场景
    key_events: List[str] = field(default_factory=list)  # 关键事件标签
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ContextWindow:
    """上下文窗口 - AI生成时需要的压缩上下文"""
    world_brief: str  # 世界观简介（300字内）
    main_characters: Dict[str, str]  # {name: 一行描述}
    recent_summary: str  # 最近章节摘要（500字内）
    current_goal: str  # 当前章节目标
    tone: str  # 基调风格
