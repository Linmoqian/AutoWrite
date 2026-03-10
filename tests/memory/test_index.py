# tests/memory/test_index.py
import pytest
from pathlib import Path
import tempfile
import json

from auto_novel.memory.index import IndexStore
from auto_novel.memory.base import WorldIndex, CharacterIndex, ChapterIndex


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


def test_index_store_init(temp_dir):
    store = IndexStore(temp_dir / "test.json")
    assert store.path == temp_dir / "test.json"


def test_save_and_load_world_index(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    world_index = WorldIndex(
        name="修仙世界",
        genre="xuanhuan",
        theme="修仙",
        keywords=["灵气", "境界"]
    )

    store.save_world_index("novel_1", world_index)

    loaded = store.load_world_index("novel_1")
    assert loaded.name == "修仙世界"
    assert loaded.genre == "xuanhuan"


def test_save_and_load_character_indices(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    chars = [
        CharacterIndex(
            id="char_1",
            name="张三",
            role="protagonist",
            importance=1.0,
            first_appearance=1
        ),
        CharacterIndex(
            id="char_2",
            name="李四",
            role="supporting",
            importance=0.5,
            first_appearance=2
        )
    ]

    store.save_character_indices("novel_1", chars)

    loaded = store.load_character_indices("novel_1")
    assert len(loaded) == 2
    assert loaded[0].name == "张三"


def test_save_and_load_chapter_indices(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    chapters = [
        ChapterIndex(
            number=1,
            title="第一章",
            summary="张三开始修仙",
            word_count=2000,
            characters=["char_1"]
        )
    ]

    store.save_chapter_indices("novel_1", chapters)

    loaded = store.load_chapter_indices("novel_1")
    assert len(loaded) == 1
    assert loaded[0].number == 1


def test_query_characters_by_importance(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    chars = [
        CharacterIndex(id="c1", name="A", role="protagonist", importance=1.0),
        CharacterIndex(id="c2", name="B", role="supporting", importance=0.5),
        CharacterIndex(id="c3", name="C", role="antagonist", importance=0.8),
    ]

    store.save_character_indices("novel_1", chars)

    # 查询重要角色 (>0.6)
    important = store.query_characters("novel_1", min_importance=0.6)
    assert len(important) == 2
    assert all(c.importance >= 0.6 for c in important)


def test_query_chapters_by_character(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    chapters = [
        ChapterIndex(number=1, title="C1", summary="", word_count=1000, characters=["A", "B"]),
        ChapterIndex(number=2, title="C2", summary="", word_count=1000, characters=["A"]),
        ChapterIndex(number=3, title="C3", summary="", word_count=1000, characters=["C"]),
    ]

    store.save_chapter_indices("novel_1", chapters)

    # 查询角色A出现的章节
    result = store.query_chapters_by_character("novel_1", "A")
    assert len(result) == 2
    assert result[0].number in [1, 2]
