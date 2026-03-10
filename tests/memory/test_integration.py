# tests/memory/test_integration.py
import pytest
from pathlib import Path
import tempfile
import json
import pickle

from auto_novel.memory.store import MemoryStore
from auto_novel.agents.novel_state import NovelState, Chapter, Character


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


def test_novel_state_to_memory_store(temp_dir):
    """测试 NovelState 转换为 MemoryStore"""
    # 创建 NovelState
    state = NovelState(
        id="test_novel",
        title="测试小说",
        genre="xuanhuan",
        theme="修仙",
        world_info="灵气复苏世界",
        characters=[
            Character(
                name="张三",
                role="protagonist",
                description="主角",
                background="农家子弟"
            )
        ],
        chapters=[
            Chapter(
                number=1,
                title="第一章",
                content="张三开始修仙" * 100,
                summary="开始修仙",
                word_count=500
            )
        ],
        total_chapters_planned=100
    )

    # 创建 MemoryStore 并迁移
    store = MemoryStore(novel_id=state.id, data_dir=temp_dir)

    # 初始化世界（从 world_info 转换）
    world_info = {
        "world_name": state.title,
        "background": state.world_info,
        "elements": {},
        "locations": [],
        "power_system": {}
    }
    store.initialize_world(state.genre, state.theme, world_info)

    # 添加角色
    for char in state.characters:
        char_dict = {
            "name": char.name,
            "identity": char.role,
            "personality": {"特征": []},
            "background": {"出身": char.background}
        }
        store.add_character(char_dict)

    # 添加章节
    for ch in state.chapters:
        chapter_dict = {
            "number": ch.number,
            "title": ch.title,
            "content": ch.content,
            "summary": ch.summary,
            "characters": [c.name for c in state.characters]
        }
        store.add_chapter(chapter_dict)

    # 验证
    window = store.build_context_window(chapter_num=2, current_goal="继续创作")

    assert "修仙" in window.world_brief or "灵气" in window.world_brief
    assert "张三" in window.main_characters
    assert store.get_statistics()["total_chapters"] == 1


def test_context_window_size_comparison(temp_dir):
    """比较新旧方式的上下文大小"""
    # 旧方式：直接传完整 NovelState
    old_state = NovelState(
        id="test",
        title="T" * 50,
        genre="xuanhuan",
        theme="修仙",
        world_info="背景" * 200,
        characters=[
            Character(
                name=f"角色{i}",
                role="protagonist",
                description="描述" * 50,
                background="背景" * 50
            ) for i in range(10)
        ],
        chapters=[
            Chapter(
                number=i,
                title=f"第{i}章",
                content="内容" * 500,
                summary="摘要" * 20,
                word_count=2000
            ) for i in range(50)
        ]
    )

    # 新方式：使用 MemoryStore
    store = MemoryStore(novel_id="test", data_dir=temp_dir)
    store.initialize_world("xuanhuan", "修仙", {
        "world_name": old_state.title,
        "background": old_state.world_info,
        "elements": {},
        "locations": [],
        "power_system": {}
    })

    for char in old_state.characters:
        store.add_character({
            "name": char.name,
            "identity": char.role,
            "personality": {},
            "background": {}
        })

    for ch in old_state.chapters:
        store.add_chapter({
            "number": ch.number,
            "title": ch.title,
            "content": ch.content,
            "summary": ch.summary,
            "characters": []
        })

    # 比较大小
    old_size = len(pickle.dumps(old_state))

    window = store.build_context_window(chapter_num=51)
    new_size = len(pickle.dumps(window))

    # 新方式应该显著更小
    compression_ratio = new_size / old_size
    assert compression_ratio < 0.25, f"压缩比例 {compression_ratio:.2%} 应小于 25%"


def test_query_efficiency(temp_dir):
    """测试查询效率"""
    import time

    store = MemoryStore(novel_id="test", data_dir=temp_dir)

    # 添加100个章节
    for i in range(100):
        store.add_chapter({
            "number": i + 1,
            "title": f"第{i+1}章",
            "content": "内容" * 100,
            "summary": f"摘要{i % 10}" * 5,  # 重复摘要
            "characters": ["角色A"] if i % 2 == 0 else []
        })

    # 测试查询角色出现的章节
    start = time.time()
    appearances = store.query_character_appearances("角色A")
    query_time = time.time() - start

    assert len(appearances) == 50
    assert query_time < 0.1  # 应该在100ms内完成
