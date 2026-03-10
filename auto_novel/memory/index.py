# auto_novel/memory/index.py
import json
from pathlib import Path
from typing import List, Optional, Dict
from dataclasses import asdict

from .base import WorldIndex, CharacterIndex, ChapterIndex


class IndexStore:
    """索引层存储 - 轻量级元数据，常驻内存"""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

        # 内存缓存
        self._world_indices: Dict[str, WorldIndex] = {}
        self._character_indices: Dict[str, List[CharacterIndex]] = {}
        self._chapter_indices: Dict[str, List[ChapterIndex]] = {}

    def _load_all(self):
        """加载所有索引到内存"""
        if not self.path.exists():
            return

        with open(self.path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for novel_id, world_data in data.get("worlds", {}).items():
            self._world_indices[novel_id] = WorldIndex(**world_data)

        for novel_id, chars_data in data.get("characters", {}).items():
            self._character_indices[novel_id] = [
                CharacterIndex(**c) for c in chars_data
            ]

        for novel_id, ch_data in data.get("chapters", {}).items():
            self._chapter_indices[novel_id] = [
                ChapterIndex(**c) for c in ch_data
            ]

    def _save_all(self):
        """保存所有索引到磁盘"""
        data = {
            "worlds": {
                k: asdict(v) for k, v in self._world_indices.items()
            },
            "characters": {
                k: [asdict(c) for c in chars]
                for k, chars in self._character_indices.items()
            },
            "chapters": {
                k: [asdict(c) for c in chapters]
                for k, chapters in self._chapter_indices.items()
            }
        }

        with open(self.path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_world_index(self, novel_id: str, index: WorldIndex):
        self._world_indices[novel_id] = index
        self._save_all()

    def load_world_index(self, novel_id: str) -> Optional[WorldIndex]:
        if novel_id in self._world_indices:
            return self._world_indices[novel_id]

        self._load_all()
        return self._world_indices.get(novel_id)

    def save_character_indices(self, novel_id: str, indices: List[CharacterIndex]):
        self._character_indices[novel_id] = indices
        self._save_all()

    def load_character_indices(self, novel_id: str) -> List[CharacterIndex]:
        if novel_id in self._character_indices:
            return self._character_indices[novel_id]

        self._load_all()
        return self._character_indices.get(novel_id, [])

    def save_chapter_indices(self, novel_id: str, indices: List[ChapterIndex]):
        self._chapter_indices[novel_id] = indices
        self._save_all()

    def load_chapter_indices(self, novel_id: str) -> List[ChapterIndex]:
        if novel_id in self._chapter_indices:
            return self._chapter_indices[novel_id]

        self._load_all()
        return self._chapter_indices.get(novel_id, [])

    def query_characters(
        self, novel_id: str, min_importance: float = 0.0
    ) -> List[CharacterIndex]:
        """查询角色，按重要性筛选"""
        chars = self.load_character_indices(novel_id)
        return [c for c in chars if c.importance >= min_importance]

    def query_chapters_by_character(
        self, novel_id: str, character_name: str
    ) -> List[ChapterIndex]:
        """查询某角色出现的章节"""
        chapters = self.load_chapter_indices(novel_id)
        return [c for c in chapters if character_name in c.characters]
