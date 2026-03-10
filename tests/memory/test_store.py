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
