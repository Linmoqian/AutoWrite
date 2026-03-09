"""小说状态数据类模块"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class Chapter:
    """章节数据类"""

    number: int
    title: str
    content: str
    summary: str
    word_count: int
    created_at: datetime = field(default_factory=datetime.now)
    published: bool = False


@dataclass
class Character:
    """角色数据类"""

    name: str
    role: str  # 主角/配角/反派
    description: str
    background: str


@dataclass
class NovelState:
    """小说状态数据类"""

    id: str
    title: str
    genre: str
    theme: str
    world_info: str = ""
    characters: List[Character] = field(default_factory=list)
    outline: List[dict] = field(default_factory=list)
    chapters: List[Chapter] = field(default_factory=list)
    total_chapters_planned: int = 100
    current_chapter: int = 0
    total_words: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def get_previous_summary(self, n: int = 3) -> str:
        """获取最近n章的摘要"""
        recent = self.chapters[-n:] if len(self.chapters) >= n else self.chapters
        return "\n\n".join([f"第{ch.number}章: {ch.summary}" for ch in recent])

    def add_chapter(self, chapter: Chapter) -> None:
        """添加新章节"""
        self.chapters.append(chapter)
        self.total_words += chapter.word_count
        self.current_chapter = chapter.number
        self.updated_at = datetime.now()

    def add_character(self, character: Character) -> None:
        """添加角色"""
        self.characters.append(character)
        self.updated_at = datetime.now()

    def get_character_by_name(self, name: str) -> Optional[Character]:
        """根据名称获取角色"""
        for char in self.characters:
            if char.name == name:
                return char
        return None

    def get_chapter_by_number(self, number: int) -> Optional[Chapter]:
        """根据章节号获取章节"""
        for chapter in self.chapters:
            if chapter.number == number:
                return chapter
        return None

    def get_progress_percentage(self) -> float:
        """获取创作进度百分比"""
        if self.total_chapters_planned == 0:
            return 0.0
        return (self.current_chapter / self.total_chapters_planned) * 100

    def get_main_characters(self) -> List[Character]:
        """获取所有主角"""
        return [c for c in self.characters if c.role == "主角"]
