"""核心逻辑模块测试"""

import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# 添加模块路径
sys.path.insert(0, "/Volumes/base/project/WriteOnMac/novel-lite")


class TestNovelCreate:
    """Novel.create 测试"""

    def test_create_novel(self, tmp_path: Path, monkeypatch):
        """测试创建小说"""
        monkeypatch.chdir(tmp_path)

        from core import Novel
        novel = Novel()
        novel.create("测试小说", "xuanhuan", "修仙", 100)

        # 验证文件创建
        assert Path("novel.md").exists()
        assert Path("context.md").exists()

        # 验证内容
        from files import read_novel, read_context_dict
        data = read_novel()
        assert data["title"] == "测试小说"
        assert data["genre"] == "xuanhuan"
        assert data["target_chapters"] == 100

        ctx = read_context_dict()
        assert ctx["current_chapter"] == 0


class TestNovelOutline:
    """Novel.generate_outline 测试"""

    @patch("core.generate")
    def test_generate_outline(self, mock_generate, tmp_path: Path, monkeypatch):
        """测试生成大纲"""
        monkeypatch.chdir(tmp_path)

        # 设置 mock 返回值
        mock_generate.side_effect = [
            "这是一个修仙世界",  # 世界观
            "主角：张三",  # 角色
            "## 第一卷\n- 001. 开端\n- 002. 相遇"  # 大纲
        ]

        from core import Novel
        from files import write_novel
        # 先创建小说
        write_novel({"title": "测试", "genre": "xuanhuan", "theme": "修仙", "target_chapters": 100})

        novel = Novel()
        novel.generate_outline()

        # 验证调用次数
        assert mock_generate.call_count == 3

        # 验证大纲文件
        from files import read_outline
        outline = read_outline()
        assert len(outline) > 0

    @patch("core.generate")
    def test_generate_outline_sequence(self, mock_generate, tmp_path: Path, monkeypatch):
        """测试大纲生成顺序"""
        monkeypatch.chdir(tmp_path)

        call_order = []
        mock_generate.side_effect = lambda prompt, **kwargs: (
            call_order.append("world") if "创建世界观" in prompt else
            call_order.append("character") if "创建小说角色" in prompt else
            call_order.append("outline")
        ) or "内容"

        from core import Novel
        from files import write_novel
        write_novel({"title": "测试", "genre": "xuanhuan", "theme": "修仙"})

        novel = Novel()
        novel.generate_outline()

        # 验证顺序：世界观 → 角色 → 大纲
        assert call_order == ["world", "character", "outline"]


class TestNovelWriteChapter:
    """Novel.write_chapter 测试"""

    @patch("core.generate")
    def test_write_chapter(self, mock_generate, tmp_path: Path, monkeypatch):
        """测试撰写章节"""
        monkeypatch.chdir(tmp_path)

        # 设置 mock
        mock_generate.side_effect = [
            "章节内容...",  # 章节正文
            "章节摘要"  # 摘要
        ]

        from core import Novel
        from files import write_novel, write_outline, write_context
        # 准备环境
        write_novel({"title": "测试", "genre": "xuanhuan", "words_per_chapter": 3000})
        write_outline([{"volume": "第一卷", "chapters": [{"num": 1, "title": "开端"}]}])
        write_context({"current_chapter": 0, "recent_summaries": []})

        novel = Novel()
        chapter_num = novel.write_chapter()

        assert chapter_num == 1
        assert (Path("chapters") / "001-开端.md").exists()

    def test_get_next_chapter_num(self, tmp_path: Path, monkeypatch):
        """测试获取下一章号"""
        monkeypatch.chdir(tmp_path)

        from core import Novel
        from files import write_context
        write_context({"current_chapter": 5, "recent_summaries": []})

        novel = Novel()
        assert novel._get_next_chapter_num() == 6
