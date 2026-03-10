# tests/memory/test_compressor.py
import pytest
from auto_novel.memory.compressor import ContextCompressor


def test_compress_world_info():
    compressor = ContextCompressor()

    world_info = {
        "world_name": "修仙世界",
        "background": "这是一个灵气复苏的世界，修仙者可以通过吸收天地灵气来提升自己的境界。修仙界分为十大宗门，每个宗门都有自己的传承和秘境。",
        "elements": {"修炼": "吸收灵气提升境界", "法宝": "修仙者使用的武器"},
        "locations": [
            {"name": "青云宗", "description": "正道大宗"},
            {"name": "血月谷", "description": "魔道据点"}
        ],
        "power_system": {
            "levels": ["炼气", "筑基", "金丹", "元婴"],
            "rules": "每一层都需要突破瓶颈"
        }
    }

    brief = compressor.compress_world(world_info, max_length=300)
    assert len(brief) <= 350  # 允许少量溢出
    assert "修仙" in brief
    assert "青云宗" in brief or "大宗" in brief


def test_compress_character():
    compressor = ContextCompressor()

    character = {
        "name": "张三",
        "identity": "青云宗外门弟子",
        "personality": {
            "特征": ["坚毅", "善良", "热血"],
            "习惯": "每日修炼",
            "说话方式": "直爽"
        },
        "background": {
            "出身": "农家子弟",
            "经历": ["偶然获得修炼功法", "加入青云宗"],
            "动机": "保护家人"
        },
        "abilities": {
            "主要能力": ["火焰术", "炼气期三层"],
            "强项": ["意志坚定"],
            "弱点": ["实力低微"]
        }
    }

    brief = compressor.compress_character(character)
    assert "张三" in brief
    assert len(brief) < 100  # 一行描述


def test_compress_chapter_summary_chain():
    compressor = ContextCompressor()

    chapters = [
        "第一章：张三在山中偶然发现一本修仙功法，开始尝试修炼。",
        "第二章：张三突破炼气期一层，引起村里人的注意。",
        "第三章：青云宗使者来到村里，张三被选中入门。"
    ]

    chain = compressor.compress_summary_chain(chapters, max_length=500)
    assert len(chain) <= 550
    assert "修仙功法" in chain or "功法" in chain
    assert "青云宗" in chain


def test_extract_keywords():
    compressor = ContextCompressor()

    text = "张三在青云宗修炼火焰术，目标是突破到筑基期。他遇到了李四，两人成为好友。"

    keywords = compressor.extract_keywords(text, top_k=10)
    assert len(keywords) <= 10
    assert isinstance(keywords, list)


def test_build_character_index():
    compressor = ContextCompressor()

    character = {
        "name": "张三",
        "identity": "主角",
        "personality": {"特征": ["坚毅", "善良"]},
        "background": {"动机": "保护家人"}
    }

    index = compressor.build_character_index(character, chapter_num=1)
    assert index.name == "张三"
    assert index.importance > 0
    assert index.first_appearance == 1
