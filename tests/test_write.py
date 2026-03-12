import sys
sys.path.insert(0, "novel")

import pytest
from write import parse_yaml_front_matter, build_yaml_front_matter


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
