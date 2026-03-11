# tests/memory/test_store.py
import pytest
from pathlib import Path
import tempfile

from auto_novel.memory.store import MemoryStore
from auto_novel.memory.base import ContextWindow


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


def test_memory_store_init(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)
    assert store.novel_id == "test_novel"


def test_initialize_world(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    world_info = {
        "world_name": "修仙世界",
        "background": "灵气复苏的世界",
        "elements": {"修炼": "吸收灵气"},
        "locations": [{"name": "青云宗", "description": "正道大宗"}],
        "power_system": {"levels": ["炼气", "筑基"]}
    }

    store.initialize_world("xuanhuan", "修仙", world_info)

    # 验证索引创建
    index = store.index_store.load_world_index("test_novel")
    assert index.name == "修仙世界"
    assert index.power_system_exists


def test_add_character(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    character = {
        "name": "张三",
        "identity": "protagonist",
        "personality": {"特征": ["坚毅"]},
        "background": {"动机": "保护家人"}
    }

    store.add_character(character, chapter_num=1)

    chars = store.index_store.load_character_indices("test_novel")
    assert len(chars) == 1
    assert chars[0].name == "张三"
    assert chars[0].importance == 1.0


def test_add_chapter(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    chapter = {
        "number": 1,
        "title": "第一章",
        "content": "张三开始修仙之路。他在山中偶然发现一本功法，开始修炼。" * 10,
        "summary": "张三发现修仙功法",
        "characters": ["张三"]
    }

    store.add_chapter(chapter)

    chapters = store.index_store.load_chapter_indices("test_novel")
    assert len(chapters) == 1
    assert chapters[0].number == 1
    assert chapters[0].word_count > 0


def test_build_context_window(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 初始化世界
    world_info = {
        "world_name": "修仙世界",
        "background": "灵气复苏，修仙者通过吸收灵气提升境界。",
        "elements": {},
        "locations": [],
        "power_system": {}
    }
    store.initialize_world("xuanhuan", "修仙", world_info)

    # 添加角色
    store.add_character({
        "name": "张三",
        "identity": "protagonist",
        "personality": {"特征": ["坚毅", "善良"]},
        "background": {"动机": "保护家人"}
    }, chapter_num=1)

    # 添加章节
    store.add_chapter({
        "number": 1,
        "title": "第一章",
        "content": "张三开始修仙",
        "summary": "张三发现功法开始修炼",
        "characters": ["张三"]
    })

    # 构建上下文窗口
    window = store.build_context_window(
        chapter_num=2,
        current_goal="突破炼气期一层"
    )

    assert isinstance(window, ContextWindow)
    assert "修仙" in window.world_brief
    assert "张三" in window.main_characters
    assert "突破炼气期一层" in window.current_goal
    assert len(window.world_brief) <= 300


def test_query_character_appearances(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 添加多个章节
    for i in range(1, 4):
        store.add_chapter({
            "number": i,
            "title": f"第{i}章",
            "content": "内容",
            "summary": f"第{i}章摘要",
            "characters": ["张三"] if i <= 2 else []
        })

    appearances = store.query_character_appearances("张三")
    assert len(appearances) == 2
    assert appearances[0].number == 1


def test_compress_size(temp_dir):
    """测试压缩后的数据大小"""
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 添加大量数据
    world_info = {
        "world_name": "W" * 100,
        "background": "背景" * 500,
        "elements": {f"元素{i}": "描述" * 50 for i in range(10)},
        "locations": [{"name": f"地点{i}", "description": "描述" * 30} for i in range(20)],
        "power_system": {"levels": [f"境界{i}" for i in range(10)]}
    }
    store.initialize_world("xuanhuan", "修仙", world_info)

    # 添加100个章节
    for i in range(100):
        store.add_chapter({
            "number": i + 1,
            "title": f"第{i+1}章",
            "content": "内容" * 1000,
            "summary": f"第{i+1}章摘要" * 5,
            "characters": ["角色A", "角色B"]
        })

    # 构建上下文窗口
    window = store.build_context_window(
        chapter_num=101,
        current_goal="继续创作"
    )

    # 验证压缩后的大小
    total_size = (
        len(window.world_brief) +
        len(window.current_goal) +
        len(window.tone) +
        sum(len(k) + len(v) for k, v in window.main_characters.items()) +
        len(window.recent_summary)
    )

    # 总上下文应该远小于原始数据
    assert total_size < 2000  # 目标是2KB以内


def test_get_statistics(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 初始化世界
    store.initialize_world("xuanhuan", "修仙", {
        "world_name": "测试世界",
        "background": "",
        "elements": {},
        "locations": [],
        "power_system": {}
    })

    # 添加角色
    store.add_character({
        "name": "张三",
        "identity": "protagonist",
        "personality": {},
        "background": {}
    })

    # 添加章节
    store.add_chapter({
        "number": 1,
        "title": "第一章",
        "content": "内容" * 100,
        "summary": "摘要",
        "characters": []
    })

    stats = store.get_statistics()
    assert stats["total_chapters"] == 1
    assert stats["total_characters"] == 1
    assert stats["total_words"] == 200  # "内容" * 100 = 2*100
    assert stats["world_name"] == "测试世界"


def test_context_window_respects_chapter_order(temp_dir):
    """验证乱序添加章节后 context_window 正确按章节号排序"""
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 初始化世界
    world_info = {
        "world_name": "修仙世界",
        "background": "灵气复苏",
        "elements": {},
        "locations": [],
        "power_system": {}
    }
    store.initialize_world("xuanhuan", "修仙", world_info)

    # 乱序添加章节
    for num in [5, 1, 3, 2, 4]:
        store.add_chapter({
            "number": num,
            "title": f"第{num}章",
            "content": f"第{num}章内容" * 10,
            "summary": f"第{num}章摘要",
            "characters": []
        })

    # 构建上下文，最近3章应该是 3,4,5 而不是添加顺序(5,1,3的最后3个)
    window = store.build_context_window(chapter_num=6, max_recent=3)

    # 验证 recent_summary 包含正确的章节
    # 按章节号排序后取最后3章：3,4,5
    assert "第3章摘要" in window.recent_summary
    assert "第4章摘要" in window.recent_summary
    assert "第5章摘要" in window.recent_summary

    # 验证不包含第1章和第2章（因为只取最后3章）
    assert "第1章摘要" not in window.recent_summary
    assert "第2章摘要" not in window.recent_summary


def test_query_character_appearances_sorted(temp_dir):
    """验证 query_character_appearances 返回结果按章节号排序"""
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 乱序添加章节，角色"张三"出现在第1、3、5章
    for num in [5, 1, 3, 2, 4]:
        store.add_chapter({
            "number": num,
            "title": f"第{num}章",
            "content": f"第{num}章内容",
            "summary": f"第{num}章摘要",
            "characters": ["张三"] if num in [1, 3, 5] else []
        })

    appearances = store.query_character_appearances("张三")

    # 验证返回了3个章节
    assert len(appearances) == 3

    # 验证按章节号排序：1, 3, 5
    assert appearances[0].number == 1
    assert appearances[1].number == 3
    assert appearances[2].number == 5
