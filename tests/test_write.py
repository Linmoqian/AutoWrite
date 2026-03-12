import os
import sys
sys.path.insert(0, "novel")

import pytest
from pathlib import Path
from write import parse_yaml_front_matter, build_yaml_front_matter, write_file, read_file, write_novel, read_novel


class TestYAMLParsing:
    """测试 YAML front matter 解析"""

    def test_parse_simple_yaml(self):
        """解析简单 YAML"""
        content = """---
title: 修仙传奇
genre: xuanhuan
---
# 正文"""
        result = parse_yaml_front_matter(content)
        assert result["title"] == "修仙传奇"
        assert result["genre"] == "xuanhuan"

    def test_parse_with_body(self):
        """解析带正文的内容"""
        content = """---
title: 测试
---
# 世界观
内容"""
        meta, body = parse_yaml_front_matter(content, return_body=True)
        assert meta["title"] == "测试"
        assert "# 世界观" in body

    def test_parse_no_yaml(self):
        """无 YAML 时返回空字典"""
        content = "# 只有正文"
        result = parse_yaml_front_matter(content)
        assert result == {}

    def test_build_yaml_front_matter(self):
        """构建 YAML front matter"""
        data = {"title": "测试", "count": 10}
        result = build_yaml_front_matter(data)
        assert "title: 测试" in result
        assert "count: 10" in result
        assert result.startswith("---\n")
        assert result.endswith("\n---\n")


class TestNovelFileOps:
    """测试小说文件操作"""

    def test_write_and_read_novel(self, tmp_path):
        """写入并读取 novel.md"""
        os.chdir(tmp_path)

        data = {
            "title": "测试小说",
            "genre": "xuanhuan",
            "theme": "修仙",
            "target_chapters": 100,
            "words_per_chapter": 3000,
            "model": "deepseek-r1:7b",
            "world": "测试世界观",
            "characters": "测试角色"
        }

        write_novel(data)
        result = read_novel()

        assert result["title"] == "测试小说"
        assert result["genre"] == "xuanhuan"
        assert result["world"] == "测试世界观"

    def test_read_novel_not_exist(self, tmp_path):
        """读取不存在的文件返回空字典"""
        os.chdir(tmp_path)
        result = read_novel()
        assert result == {}

    def test_write_creates_backup(self, tmp_path):
        """写入时创建备份"""
        os.chdir(tmp_path)

        # 第一次写入
        write_novel({"title": "第一版"})
        # 第二次写入
        write_novel({"title": "第二版"})

        # 检查备份文件存在
        assert Path("novel.md.bak").exists()
