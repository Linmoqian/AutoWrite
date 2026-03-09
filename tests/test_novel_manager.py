"""小说管理器测试模块"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch

from auto_novel.agents.novel_state import Chapter, Character, NovelState
from auto_novel.agents.novel_manager import NovelManager


class TestNovelState:
    """测试 NovelState 数据类"""

    def test_create_novel_state(self):
        """测试创建小说状态"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        assert state.id == "test123"
        assert state.title == "测试小说"
        assert state.genre == "玄幻"
        assert state.theme == "成长与冒险"
        assert state.world_info == ""
        assert len(state.characters) == 0
        assert len(state.chapters) == 0
        assert state.total_chapters_planned == 100
        assert state.current_chapter == 0
        assert state.total_words == 0

    def test_get_previous_summary_empty(self):
        """测试空章节时获取摘要"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        summary = state.get_previous_summary()
        assert summary == ""

    def test_get_previous_summary_with_chapters(self):
        """测试有章节时获取摘要"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        # 添加几个章节
        state.chapters = [
            Chapter(number=1, title="第一章", content="", summary="第一章摘要", word_count=100),
            Chapter(number=2, title="第二章", content="", summary="第二章摘要", word_count=100),
            Chapter(number=3, title="第三章", content="", summary="第三章摘要", word_count=100),
        ]
        summary = state.get_previous_summary(n=2)
        assert "第2章: 第二章摘要" in summary
        assert "第3章: 第三章摘要" in summary
        assert "第1章" not in summary

    def test_get_previous_summary_less_than_n(self):
        """测试章节数少于n时获取摘要"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        state.chapters = [
            Chapter(number=1, title="第一章", content="", summary="第一章摘要", word_count=100),
        ]
        summary = state.get_previous_summary(n=3)
        assert "第1章: 第一章摘要" in summary

    def test_add_chapter(self):
        """测试添加章节"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        chapter = Chapter(
            number=1,
            title="第一章",
            content="测试内容",
            summary="测试摘要",
            word_count=100,
        )
        state.add_chapter(chapter)
        assert len(state.chapters) == 1
        assert state.current_chapter == 1
        assert state.total_words == 100

    def test_add_character(self):
        """测试添加角色"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        character = Character(
            name="张三",
            role="主角",
            description="勇敢的少年",
            background="出身贫寒",
        )
        state.add_character(character)
        assert len(state.characters) == 1
        assert state.characters[0].name == "张三"

    def test_get_character_by_name(self):
        """测试根据名称获取角色"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        state.characters = [
            Character(name="张三", role="主角", description="", background=""),
            Character(name="李四", role="配角", description="", background=""),
        ]
        char = state.get_character_by_name("张三")
        assert char is not None
        assert char.name == "张三"
        assert char.role == "主角"

    def test_get_character_by_name_not_found(self):
        """测试获取不存在的角色"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        char = state.get_character_by_name("不存在")
        assert char is None

    def test_get_chapter_by_number(self):
        """测试根据章节号获取章节"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        state.chapters = [
            Chapter(number=1, title="第一章", content="", summary="", word_count=100),
            Chapter(number=2, title="第二章", content="", summary="", word_count=100),
        ]
        chapter = state.get_chapter_by_number(2)
        assert chapter is not None
        assert chapter.number == 2

    def test_get_progress_percentage(self):
        """测试获取创作进度百分比"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
            total_chapters_planned=100,
        )
        state.current_chapter = 25
        progress = state.get_progress_percentage()
        assert progress == 25.0

    def test_get_main_characters(self):
        """测试获取所有主角"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长与冒险",
        )
        state.characters = [
            Character(name="张三", role="主角", description="", background=""),
            Character(name="李四", role="配角", description="", background=""),
            Character(name="王五", role="主角", description="", background=""),
        ]
        main_chars = state.get_main_characters()
        assert len(main_chars) == 2
        names = [c.name for c in main_chars]
        assert "张三" in names
        assert "王五" in names


class TestChapter:
    """测试 Chapter 数据类"""

    def test_create_chapter(self):
        """测试创建章节"""
        chapter = Chapter(
            number=1,
            title="第一章 开始",
            content="这是章节内容",
            summary="章节摘要",
            word_count=100,
        )
        assert chapter.number == 1
        assert chapter.title == "第一章 开始"
        assert chapter.content == "这是章节内容"
        assert chapter.summary == "章节摘要"
        assert chapter.word_count == 100
        assert chapter.published is False
        assert isinstance(chapter.created_at, datetime)


class TestCharacter:
    """测试 Character 数据类"""

    def test_create_character(self):
        """测试创建角色"""
        character = Character(
            name="张三",
            role="主角",
            description="勇敢的少年英雄",
            background="出身于普通农家",
        )
        assert character.name == "张三"
        assert character.role == "主角"
        assert character.description == "勇敢的少年英雄"
        assert character.background == "出身于普通农家"


class TestNovelManager:
    """测试 NovelManager 类"""

    @pytest.fixture
    def mock_llm_client(self):
        """模拟 LLM 客户端"""
        client = Mock()
        client.generate = Mock(return_value="模拟的LLM响应内容")
        return client

    @pytest.fixture
    def manager(self, mock_llm_client):
        """创建带有模拟客户端的管理器"""
        with patch("auto_novel.agents.novel_manager.get_llm_client") as mock_get_client:
            mock_get_client.return_value = mock_llm_client
            manager = NovelManager()
            manager.llm_client = mock_llm_client
            return manager

    def test_create_novel(self, manager):
        """测试创建小说"""
        novel = manager.create_novel(
            title="我的小说",
            genre="玄幻",
            theme="成长冒险",
        )
        assert novel.title == "我的小说"
        assert novel.genre == "玄幻"
        assert novel.theme == "成长冒险"
        assert len(novel.id) == 8
        assert isinstance(novel.created_at, datetime)

    def test_build_world(self, manager, mock_llm_client):
        """测试构建世界观"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长冒险",
        )
        mock_llm_client.generate.return_value = "这是一个充满魔法的世界..."
        result = manager.build_world(state)
        assert "魔法的世界" in result.world_info
        mock_llm_client.generate.assert_called_once()

    def test_create_main_character(self, manager, mock_llm_client):
        """测试创建主角"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长冒险",
            world_info="这是一个奇幻世界",
        )
        mock_llm_client.generate.return_value = "张三是一个勇敢的少年..."
        result = manager.create_main_character(state, "张三", "主角")
        assert len(result.characters) == 1
        assert result.characters[0].name == "张三"
        assert result.characters[0].role == "主角"
        mock_llm_client.generate.assert_called_once()

    def test_generate_outline(self, manager, mock_llm_client):
        """测试生成大纲"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长冒险",
            world_info="奇幻世界",
        )
        state.characters = [
            Character(name="张三", role="主角", description="勇敢的少年", background=""),
        ]
        mock_llm_client.generate.return_value = """第1章：初出茅庐
概要：张三离开家乡开始冒险

第2章：神秘相遇
概要：遇到了一位神秘的老者"""
        result = manager.generate_outline(state, 2)
        assert len(result.outline) == 2
        assert result.outline[0]["number"] == 1
        assert result.outline[0]["title"] == "初出茅庐"
        assert result.total_chapters_planned == 2

    def test_write_chapter(self, manager, mock_llm_client):
        """测试撰写章节"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长冒险",
            world_info="奇幻世界",
            total_chapters_planned=10,
        )
        state.characters = [
            Character(name="张三", role="主角", description="勇敢的少年", background=""),
        ]
        state.outline = [
            {"number": 1, "title": "初出茅庐", "summary": "张三离开家乡"},
        ]
        mock_llm_client.generate.side_effect = [
            "这是第一章的正文内容..." * 100,  # 章节内容
            "第一章摘要内容",  # 摘要
        ]
        result = manager.write_chapter(state, 1)
        assert len(result.chapters) == 1
        assert result.chapters[0].number == 1
        assert result.chapters[0].title == "初出茅庐"
        assert result.current_chapter == 1
        assert result.total_words > 0

    def test_write_chapter_out_of_range(self, manager):
        """测试撰写超出范围的章节"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长冒险",
            total_chapters_planned=10,
        )
        with pytest.raises(ValueError, match="超出范围"):
            manager.write_chapter(state, 11)

    def test_write_chapter_no_outline(self, manager):
        """测试撰写没有大纲的章节"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长冒险",
            total_chapters_planned=10,
            outline=[],
        )
        with pytest.raises(ValueError, match="未找到"):
            manager.write_chapter(state, 1)

    def test_parse_outline(self, manager):
        """测试解析大纲文本"""
        outline_text = """第1章：初出茅庐
概要：张三离开家乡开始冒险

第2章：神秘相遇
概要：遇到了一位神秘的老者

第3章：修炼之路
概要：开始学习魔法"""
        result = manager._parse_outline(outline_text)
        assert len(result) == 3
        assert result[0]["number"] == 1
        assert result[0]["title"] == "初出茅庐"
        assert "离开家乡" in result[0]["summary"]
        assert result[1]["number"] == 2
        assert result[2]["number"] == 3

    def test_get_novel_stats(self, manager):
        """测试获取小说统计信息"""
        state = NovelState(
            id="test123",
            title="测试小说",
            genre="玄幻",
            theme="成长冒险",
            total_chapters_planned=100,
        )
        state.current_chapter = 25
        state.total_words = 50000
        state.characters = [Mock(), Mock(), Mock()]
        state.chapters = [Mock()] * 25
        stats = manager.get_novel_stats(state)
        assert stats["id"] == "test123"
        assert stats["title"] == "测试小说"
        assert stats["current_chapter"] == 25
        assert stats["progress_percentage"] == 25.0
        assert stats["total_words"] == 50000
        assert stats["character_count"] == 3
        assert stats["chapter_count"] == 25
