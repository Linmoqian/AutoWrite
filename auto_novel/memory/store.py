# auto_novel/memory/store.py
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import asdict

from .base import (
    WorldIndex, CharacterIndex, ChapterIndex,
    ContextWindow, CompressionLevel
)
from .index import IndexStore
from .compressor import ContextCompressor


class MemoryStore:
    """三层存储管理器

    - 索引层: 热数据，常驻内存
    - 上下文层: 温数据，按需加载
    - 完整层: 冷数据，文件存储
    """

    def __init__(self, novel_id: str, data_dir: Path):
        self.novel_id = novel_id
        self.data_dir = Path(data_dir)
        self.novel_dir = self.data_dir / novel_id
        self.novel_dir.mkdir(parents=True, exist_ok=True)

        # 初始化各层存储
        self.index_store = IndexStore(self.novel_dir / "index.json")
        self.compressor = ContextCompressor()

        # 完整数据路径
        self.world_file = self.novel_dir / "world.json"
        self.characters_file = self.novel_dir / "characters.json"
        self.chapters_dir = self.novel_dir / "chapters"
        self.chapters_dir.mkdir(exist_ok=True)

    def initialize_world(
        self, genre: str, theme: str, world_info: Dict[str, Any]
    ):
        """初始化世界观数据"""
        # 保存完整世界观数据
        with open(self.world_file, 'w', encoding='utf-8') as f:
            json.dump(world_info, f, ensure_ascii=False, indent=2)

        # 构建并保存索引
        world_index = self.compressor.build_world_index(world_info)
        world_index.genre = genre
        world_index.theme = theme
        self.index_store.save_world_index(self.novel_id, world_index)

    def add_character(self, character: Dict[str, Any], chapter_num: int = 0):
        """添加角色"""
        # 加载现有角色
        characters = []
        if self.characters_file.exists():
            with open(self.characters_file, 'r', encoding='utf-8') as f:
                characters = json.load(f)

        # 检查是否已存在
        name = character.get("name")
        for i, c in enumerate(characters):
            if c.get("name") == name:
                characters[i] = character  # 更新
                break
        else:
            characters.append(character)

        # 保存完整数据
        with open(self.characters_file, 'w', encoding='utf-8') as f:
            json.dump(characters, f, ensure_ascii=False, indent=2)

        # 更新索引
        indices = self.index_store.load_character_indices(self.novel_id)
        char_index = self.compressor.build_character_index(character, chapter_num)

        # 更新现有或添加新索引
        for i, idx in enumerate(indices):
            if idx.name == name:
                indices[i].last_appearance = chapter_num
                break
        else:
            indices.append(char_index)

        self.index_store.save_character_indices(self.novel_id, indices)

    def add_chapter(self, chapter: Dict[str, Any]):
        """添加章节"""
        number = chapter["number"]

        # 保存完整章节内容
        chapter_file = self.chapters_dir / f"chapter_{number:04d}.json"
        with open(chapter_file, 'w', encoding='utf-8') as f:
            json.dump(chapter, f, ensure_ascii=False, indent=2)

        # 构建并添加索引
        content = chapter.get("content", "")
        chapter_index = self.compressor.build_chapter_index(
            number=number,
            title=chapter.get("title", ""),
            content=content,
            summary=chapter.get("summary", ""),
            characters=chapter.get("characters", [])
        )

        indices = self.index_store.load_chapter_indices(self.novel_id)
        indices.append(chapter_index)
        self.index_store.save_chapter_indices(self.novel_id, indices)

    def build_context_window(
        self,
        chapter_num: int,
        current_goal: str = "",
        max_recent: int = 3
    ) -> ContextWindow:
        """构建AI生成所需的上下文窗口"""
        # 加载世界观数据
        world_info = {}
        if self.world_file.exists():
            with open(self.world_file, 'r', encoding='utf-8') as f:
                world_info = json.load(f)

        # 压缩世界观
        world_brief = self.compressor.compress_world(
            world_info, max_length=300
        )

        # 加载主要角色
        character_indices = self.index_store.query_characters(
            self.novel_id, min_importance=0.6
        )
        main_characters = {}
        if self.characters_file.exists():
            with open(self.characters_file, 'r', encoding='utf-8') as f:
                all_characters = json.load(f)

            char_dict = {c["name"]: c for c in all_characters}
            for idx in character_indices:
                if idx.name in char_dict:
                    brief = self.compressor.compress_character(char_dict[idx.name])
                    main_characters[idx.name] = brief

        # 构建最近章节摘要（按章节号排序）
        chapter_indices = self.index_store.load_chapter_indices(self.novel_id)
        recent_indices = (
            sorted(chapter_indices, key=lambda x: x.number)[-max_recent:]
            if chapter_indices else []
        )

        recent_summaries = [c.summary for c in recent_indices if c.summary]
        recent_summary = self.compressor.compress_summary_chain(
            recent_summaries, max_length=500
        )

        # 获取基调
        tone = world_info.get("tone", "引人入胜")

        return ContextWindow(
            world_brief=world_brief,
            main_characters=main_characters,
            recent_summary=recent_summary,
            current_goal=current_goal,
            tone=tone
        )

    def get_full_chapter(self, chapter_num: int) -> Optional[Dict[str, Any]]:
        """获取完整章节数据（冷数据加载）"""
        chapter_file = self.chapters_dir / f"chapter_{chapter_num:04d}.json"
        if not chapter_file.exists():
            return None

        with open(chapter_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def query_character_appearances(self, character_name: str) -> List[ChapterIndex]:
        """查询角色出现的所有章节"""
        return self.index_store.query_chapters_by_character(
            self.novel_id, character_name
        )

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        chapter_indices = self.index_store.load_chapter_indices(self.novel_id)
        character_indices = self.index_store.load_character_indices(self.novel_id)
        world_index = self.index_store.load_world_index(self.novel_id)

        total_words = sum(c.word_count for c in chapter_indices)

        return {
            "total_chapters": len(chapter_indices),
            "total_characters": len(character_indices),
            "total_words": total_words,
            "main_characters": len([
                c for c in character_indices if c.importance >= 0.6
            ]),
            "world_name": world_index.name if world_index else None,
        }
