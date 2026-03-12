"""文件操作模块测试"""

from pathlib import Path

import pytest
import sys
sys.path.insert(0, "/Volumes/base/project/WriteOnMac/novel-lite")

from files import (
    read_file, write_file,
    parse_yaml_front_matter, build_yaml_front_matter,
    write_novel, read_novel,
    write_outline, read_outline,
    write_context, read_context_dict
)


class TestBasicFileOps:
    """基础文件操作测试"""

    def test_write_and_read_file(self, tmp_path: Path):
        """测试文件写入和读取"""
        test_file = tmp_path / "test.md"
        content = "# 测试内容\n\nHello World"

        write_file(test_file, content)
        result = read_file(test_file)

        assert result == content

    def test_read_nonexistent_file(self, tmp_path: Path):
        """测试读取不存在的文件"""
        test_file = tmp_path / "not_exist.md"
        result = read_file(test_file)
        assert result == ""

    def test_write_file_creates_backup(self, tmp_path: Path):
        """测试写入时创建备份"""
        test_file = tmp_path / "test.md"
        write_file(test_file, "原内容")
        write_file(test_file, "新内容")

        backup_file = Path(str(test_file) + ".bak")
        assert backup_file.exists()
        assert backup_file.read_text(encoding="utf-8") == "原内容"


class TestYamlFrontMatter:
    """YAML Front Matter 测试"""

    def test_parse_yaml_front_matter(self):
        """测试解析 YAML front matter"""
        content = "---\ntitle: 测试\ngenre: xuanhuan\n---\n\n正文内容"
        result = parse_yaml_front_matter(content)

        assert result["title"] == "测试"
        assert result["genre"] == "xuanhuan"

    def test_parse_yaml_with_body(self):
        """测试解析 YAML 并返回正文"""
        content = "---\ntitle: 测试\n---\n\n正文内容"
        meta, body = parse_yaml_front_matter(content, return_body=True)

        assert meta["title"] == "测试"
        assert body == "正文内容"

    def test_parse_content_without_yaml(self):
        """测试解析没有 YAML 的内容"""
        content = "纯文本内容"
        result = parse_yaml_front_matter(content)
        assert result == {}

    def test_build_yaml_front_matter(self):
        """测试构建 YAML front matter"""
        data = {"title": "测试", "genre": "xuanhuan"}
        result = build_yaml_front_matter(data)

        assert result.startswith("---\n")
        assert "title: 测试" in result
        assert result.endswith("---\n")


class TestNovelFileOps:
    """小说文件操作测试"""

    def test_write_and_read_novel(self, tmp_path: Path, monkeypatch):
        """测试写入和读取小说"""
        monkeypatch.chdir(tmp_path)

        data = {
            "title": "测试小说",
            "genre": "xuanhuan",
            "theme": "修仙",
            "target_chapters": 100,
            "world": "这是一个修仙世界",
            "characters": "主角：张三"
        }

        write_novel(data)
        result = read_novel()

        assert result["title"] == "测试小说"
        assert result["genre"] == "xuanhuan"
        assert "修仙世界" in result.get("world", "")

    def test_read_novel_empty(self, tmp_path: Path, monkeypatch):
        """测试读取空小说"""
        monkeypatch.chdir(tmp_path)

        result = read_novel()
        assert result == {}


class TestOutlineOps:
    """大纲操作测试"""

    def test_write_and_read_outline(self, tmp_path: Path, monkeypatch):
        """测试写入和读取大纲"""
        monkeypatch.chdir(tmp_path)

        outline = [
            {"volume": "第一卷", "chapters": [
                {"num": 1, "title": "开端"},
                {"num": 2, "title": "相遇"}
            ]}
        ]

        write_outline(outline)
        result = read_outline()

        assert len(result) == 1
        assert result[0]["volume"] == "第一卷"
        assert len(result[0]["chapters"]) == 2
        assert result[0]["chapters"][0]["title"] == "开端"


class TestContextOps:
    """上下文操作测试"""

    def test_write_and_read_context(self, tmp_path: Path, monkeypatch):
        """测试写入和读取上下文"""
        monkeypatch.chdir(tmp_path)

        context = {
            "current_chapter": 5,
            "recent_summaries": ["第1章摘要", "第2章摘要"],
            "character_states": ["主角：修炼中"],
            "pending_plots": ["伏笔1"]
        }

        write_context(context)
        result = read_context_dict()

        assert result["current_chapter"] == 5
        assert len(result["recent_summaries"]) == 2
