# tests/memory/test_base.py
import pytest
from auto_novel.memory.base import WorldIndex, CharacterIndex, ChapterIndex, ContextWindow


def test_world_index_creation():
    index = WorldIndex(
        name="修仙世界",
        genre="xuanhuan",
        theme="修仙",
        keywords=["灵气", "境界"],
        element_tags=["修炼", "法宝"]
    )
    assert index.name == "修仙世界"
    assert index.location_count == 0


def test_character_index_importance():
    index = CharacterIndex(
        id="char_1",
        name="张三",
        role="protagonist",
        importance=1.0
    )
    assert index.importance == 1.0
    assert index.first_appearance == 0


def test_chapter_index_summary_truncation():
    index = ChapterIndex(
        number=1,
        title="第一章",
        summary="a" * 300,  # 测试截断
        word_count=2000
    )
    assert len(index.summary) == 300  # 暂不截断，由压缩器处理


def test_context_window_structure():
    window = ContextWindow(
        world_brief="修仙世界，灵气复苏",
        main_characters={"张三": "主角"},
        recent_summary="张三开始修炼",
        current_goal="突破第一层",
        tone="热血"
    )
    assert len(window.main_characters) == 1
