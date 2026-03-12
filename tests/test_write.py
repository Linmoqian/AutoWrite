import os
import sys
import subprocess
import shutil
sys.path.insert(0, "novel")

import pytest
from pathlib import Path
from unittest.mock import patch
from write import (
    parse_yaml_front_matter, build_yaml_front_matter,
    write_file, read_file, write_novel, read_novel,
    write_outline, read_outline, get_chapter_outline,
    write_context, read_context, read_context_dict,
    generate, WORLD_PROMPT, CHARACTER_PROMPT, OUTLINE_PROMPT, CHAPTER_PROMPT,
    gen_world, gen_character, gen_outline, parse_outline_text,
    CHAPTERS_DIR, gen_chapter
)


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


class TestOutlineFileOps:
    """测试大纲文件操作"""

    def test_write_and_read_outline(self, tmp_path):
        """写入并读取 outline.md"""
        os.chdir(tmp_path)

        outline = [
            {"volume": "第一卷", "chapters": [
                {"num": 1, "title": "穿越"},
                {"num": 2, "title": "拜师"}
            ]},
            {"volume": "第二卷", "chapters": [
                {"num": 21, "title": "大比"}
            ]}
        ]

        write_outline(outline)
        result = read_outline()

        assert len(result) == 2
        assert result[0]["volume"] == "第一卷"
        assert len(result[0]["chapters"]) == 2
        assert result[0]["chapters"][0]["title"] == "穿越"

    def test_get_chapter_outline(self, tmp_path):
        """获取指定章节的大纲"""
        os.chdir(tmp_path)

        outline = [
            {"volume": "第一卷", "chapters": [
                {"num": 1, "title": "穿越"},
                {"num": 2, "title": "拜师"}
            ]}
        ]
        write_outline(outline)

        assert get_chapter_outline(1) == "穿越"
        assert get_chapter_outline(2) == "拜师"
        assert get_chapter_outline(999) is None


class TestContextFileOps:
    """测试上下文文件操作"""

    def test_write_and_read_context(self, tmp_path):
        """写入并读取 context.md"""
        os.chdir(tmp_path)

        context = {
            "current_chapter": 5,
            "recent_summaries": ["第1章摘要", "第2章摘要"],
            "character_states": ["林凡：筑基期"],
            "pending_plots": ["神秘传承的来历"]
        }

        write_context(context)
        result = read_context_dict()

        assert result["current_chapter"] == 5
        assert len(result["recent_summaries"]) == 2

    def test_read_context_as_text(self, tmp_path):
        """读取 context.md 作为文本（用于 Prompt）"""
        os.chdir(tmp_path)

        context = {
            "current_chapter": 5,
            "recent_summaries": ["第4章摘要"],
            "character_states": ["林凡：筑基"],
            "pending_plots": ["伏笔1"]
        }
        write_context(context)

        text = read_context()
        assert "第4章摘要" in text
        assert "林凡：筑基" in text


class TestOllamaGenerate:
    """测试 Ollama 生成函数"""

    @patch("ollama.chat")
    def test_generate_simple(self, mock_chat):
        """简单生成"""
        mock_chat.return_value = {"message": {"content": "生成的文本"}}
        result = generate("测试提示词")
        assert result == "生成的文本"

    @patch("ollama.chat")
    def test_generate_with_context(self, mock_chat):
        """带上下文生成"""
        mock_chat.return_value = {"message": {"content": "结果"}}
        result = generate("提示词", context="背景信息")
        assert result == "结果"
        call_args = mock_chat.call_args
        assert "背景信息" in call_args[1]["messages"][0]["content"]

    @patch("ollama.chat")
    def test_generate_retry_on_failure(self, mock_chat):
        """失败时重试"""
        mock_chat.side_effect = [
            Exception("网络错误"),
            Exception("超时"),
            {"message": {"content": "成功"}}
        ]
        result = generate("测试", retries=3)
        assert result == "成功"
        assert mock_chat.call_count == 3

    @patch("ollama.chat")
    def test_generate_fail_after_retries(self, mock_chat):
        """重试后仍失败抛出异常"""
        mock_chat.side_effect = Exception("持续失败")
        with pytest.raises(RuntimeError, match="Ollama 调用失败"):
            generate("测试", retries=2)


class TestGenerationFlow:
    """测试生成流程"""

    @patch("write.generate")
    def test_gen_world(self, mock_gen, tmp_path):
        """生成世界观"""
        os.chdir(tmp_path)
        write_novel({"title": "测试", "genre": "玄幻", "theme": "修仙"})
        mock_gen.return_value = "生成的世界观内容"
        gen_world()
        novel = read_novel()
        assert novel["world"] == "生成的世界观内容"

    @patch("write.generate")
    def test_gen_character(self, mock_gen, tmp_path):
        """生成角色"""
        os.chdir(tmp_path)
        write_novel({"title": "测试", "world": "测试世界观"})
        mock_gen.return_value = "## 主角：林凡\n- 身份：穿越者"
        gen_character()
        novel = read_novel()
        assert "林凡" in novel["characters"]

    @patch("write.generate")
    def test_gen_outline(self, mock_gen, tmp_path):
        """生成大纲"""
        os.chdir(tmp_path)
        write_novel({
            "title": "测试", "world": "世界观", "characters": "角色", "target_chapters": 10
        })
        mock_gen.return_value = """# 大纲

## 第一卷
- 001. 穿越
- 002. 拜师"""
        gen_outline()
        outline = read_outline()
        assert len(outline) > 0
        assert outline[0]["volume"] == "第一卷"


class TestPromptTemplates:
    """测试提示词模板"""

    def test_world_prompt(self):
        """世界观提示词"""
        prompt = WORLD_PROMPT.format(genre="玄幻", theme="修仙")
        assert "玄幻" in prompt
        assert "修仙" in prompt

    def test_character_prompt(self):
        """角色提示词"""
        prompt = CHARACTER_PROMPT.format(world="测试世界观")
        assert "测试世界观" in prompt
        assert "主角" in prompt

    def test_outline_prompt(self):
        """大纲提示词"""
        prompt = OUTLINE_PROMPT.format(world="世界观", characters="角色", total_chapters=100)
        assert "100章" in prompt

    def test_chapter_prompt(self):
        """章节提示词"""
        prompt = CHAPTER_PROMPT.format(
            context="上下文", num=1, title="测试章节",
            outline_detail="大纲详情", words=3000, style="玄幻"
        )
        assert "第1章" in prompt
        assert "3000字" in prompt


class TestChapterGeneration:
    """测试章节生成"""

    @patch("write.generate")
    def test_gen_chapter(self, mock_gen, tmp_path):
        """生成章节"""
        os.chdir(tmp_path)
        write_novel({
            "title": "测试", "genre": "玄幻", "theme": "修仙",
            "words_per_chapter": 3000,
            "world": "测试世界观", "characters": "测试角色"
        })
        write_outline([{"volume": "第一卷", "chapters": [{"num": 1, "title": "穿越"}]}])
        mock_gen.return_value = "第一章正文内容..." * 500
        gen_chapter(1)
        assert (CHAPTERS_DIR / "001-穿越.md").exists()

    @patch("write.generate")
    def test_update_context_after_chapter(self, mock_gen, tmp_path):
        """写章节后更新上下文"""
        os.chdir(tmp_path)
        mock_gen.side_effect = ["章节正文" * 100, "本章摘要：主角穿越"]
        write_novel({"title": "测试", "genre": "玄幻"})
        write_outline([{"volume": "第一卷", "chapters": [{"num": 1, "title": "测试"}]}])
        write_context({"current_chapter": 0, "recent_summaries": []})
        gen_chapter(1)
        ctx = read_context_dict()
        assert ctx["current_chapter"] == 1
        assert len(ctx["recent_summaries"]) == 1

    @patch("write.generate")
    def test_context_keeps_only_5_summaries(self, mock_gen, tmp_path):
        """上下文只保留最近5章摘要"""
        os.chdir(tmp_path)
        write_context({
            "current_chapter": 5,
            "recent_summaries": ["摘要1", "摘要2", "摘要3", "摘要4", "摘要5"]
        })
        mock_gen.side_effect = ["章节内容", "新摘要"]
        write_novel({"title": "测试"})
        write_outline([{"volume": "第一卷", "chapters": [{"num": 6, "title": "测试"}]}])
        gen_chapter(6)
        ctx = read_context_dict()
        assert len(ctx["recent_summaries"]) == 5
        assert "摘要1" not in ctx["recent_summaries"]


class TestCLI:
    """测试命令行接口"""

    def test_cli_help(self):
        """帮助信息"""
        # 获取项目根目录的 novel 文件夹路径
        novel_dir = Path(__file__).parent.parent / "novel"
        result = subprocess.run(
            ["python", "write.py", "--help"],
            cwd=novel_dir,
            capture_output=True,
            text=True
        )
        assert "new" in result.stdout or "usage" in result.stdout.lower()

    def test_cli_status_no_novel(self, tmp_path):
        """无小说时查看状态"""
        novel_dir = Path(__file__).parent.parent / "novel"
        shutil.copy(novel_dir / "write.py", tmp_path / "write.py")
        result = subprocess.run(
            ["python", "write.py", "status"],
            cwd=tmp_path,
            capture_output=True,
            text=True
        )
        assert "未找到" in result.stdout or "请先运行" in result.stdout
