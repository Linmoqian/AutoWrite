# 极简本地小说创作系统实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个极简的本地小说创作脚本，支持世界观→角色→大纲→章节的完整流程。

**Architecture:** 单文件 Python 脚本 (~400行)，使用 Ollama SDK 调用本地大模型，数据存储为 Markdown + YAML 格式。

**Tech Stack:** Python 3.10+, ollama SDK, pyyaml, Markdown

**Spec:** docs/superpowers/specs/2026-03-12-minimal-novel-writer-design.md

---

## 文件结构

```
novel/
├── write.py           # 唯一脚本（~400行）
├── novel.md           # 运行时生成
├── outline.md         # 运行时生成
├── context.md         # 运行时生成
└── chapters/          # 运行时生成

tests/
└── test_write.py      # 单元测试
```

---

## Chunk 1: 基础设施与文件操作

### Task 1: 创建目录结构和依赖

**Files:**
- Create: `novel/.gitkeep`
- Create: `requirements-novel.txt`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p novel/chapters
touch novel/.gitkeep
```

- [ ] **Step 2: 创建依赖文件**

```text
# requirements-novel.txt
ollama>=0.1.0
pyyaml>=6.0
```

- [ ] **Step 3: 安装依赖**

```bash
pip install -r requirements-novel.txt
```

- [ ] **Step 4: 提交**

```bash
git add novel/.gitkeep requirements-novel.txt
git commit -m "feat(novel): 初始化项目结构和依赖"
```

---

### Task 2: 编写 YAML/Markdown 解析测试

**Files:**
- Create: `tests/test_write.py`

- [ ] **Step 1: 编写 parse_yaml_front_matter 测试**

```python
# tests/test_write.py
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestYAMLParsing -v
```
Expected: FAIL (module not found)

- [ ] **Step 3: 实现 parse_yaml_front_matter 和 build_yaml_front_matter**

```python
# novel/write.py (部分)
import yaml
from typing import Tuple, Optional


def parse_yaml_front_matter(content: str, return_body: bool = False) -> dict | Tuple[dict, str]:
    """解析 Markdown 文件中的 YAML front matter"""
    if not content.startswith("---\n"):
        if return_body:
            return {}, content
        return {}

    parts = content.split("---\n", 2)
    if len(parts) < 3:
        if return_body:
            return {}, content
        return {}

    yaml_content = parts[1]
    body = parts[2].strip()

    data = yaml.safe_load(yaml_content) or {}

    if return_body:
        return data, body
    return data


def build_yaml_front_matter(data: dict) -> str:
    """构建 YAML front matter 字符串"""
    yaml_str = yaml.dump(data, allow_unicode=True, default_flow_style=False)
    return f"---\n{yaml_str}---\n"
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestYAMLParsing -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现 YAML front matter 解析"
```

---

### Task 3: 编写文件读写测试

**Files:**
- Modify: `tests/test_write.py`

- [ ] **Step 1: 编写 read_novel/write_novel 测试**

```python
# 添加到 tests/test_write.py
import tempfile
import os
from pathlib import Path


class TestNovelFileOps:
    """测试小说文件操作"""

    def test_write_and_read_novel(self, tmp_path):
        """写入并读取 novel.md"""
        # 切换工作目录
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestNovelFileOps -v
```
Expected: FAIL

- [ ] **Step 3: 实现 read_novel/write_novel**

```python
# 添加到 novel/write.py
import shutil
from pathlib import Path

NOVEL_FILE = Path("novel.md")
OUTLINE_FILE = Path("outline.md")
CONTEXT_FILE = Path("context.md")
CHAPTERS_DIR = Path("chapters")


def write_file(path: Path, content: str) -> None:
    """原子写入文件，带备份"""
    if path.exists():
        backup = path.with_suffix(path.suffix + ".bak")
        shutil.copy(path, backup)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.rename(path)


def read_file(path: Path) -> str:
    """读取文件内容"""
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def write_novel(data: dict) -> None:
    """写入 novel.md"""
    # 分离元数据和正文内容
    meta_keys = ["title", "genre", "theme", "target_chapters",
                 "words_per_chapter", "model", "created"]
    meta = {k: v for k, v in data.items() if k in meta_keys}

    # 构建正文
    body_parts = []
    if "world" in data:
        body_parts.append(f"# 世界观\n\n{data['world']}")
    if "characters" in data:
        body_parts.append(f"# 角色\n\n{data['characters']}")

    body = "\n\n".join(body_parts)
    content = build_yaml_front_matter(meta) + "\n" + body
    write_file(NOVEL_FILE, content)


def read_novel() -> dict:
    """读取 novel.md"""
    content = read_file(NOVEL_FILE)
    if not content:
        return {}

    meta, body = parse_yaml_front_matter(content, return_body=True)

    # 解析正文
    result = dict(meta)
    if "# 世界观" in body:
        world_section = body.split("# 世界观")[1].split("#")[0].strip()
        result["world"] = world_section
    if "# 角色" in body:
        char_section = body.split("# 角色")[1].split("#")[0].strip()
        result["characters"] = char_section

    return result
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestNovelFileOps -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现 novel.md 文件读写"
```

---

### Task 4: 编写 outline/context 文件操作

**Files:**
- Modify: `tests/test_write.py`
- Modify: `novel/write.py`

- [ ] **Step 1: 编写 outline 测试**

```python
# 添加到 tests/test_write.py
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

        result = get_chapter_outline(1)
        assert result == "穿越"

        result = get_chapter_outline(2)
        assert result == "拜师"

        result = get_chapter_outline(999)
        assert result is None
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestOutlineFileOps -v
```
Expected: FAIL

- [ ] **Step 3: 实现 outline 操作函数**

```python
# 添加到 novel/write.py
def write_outline(outline: list) -> None:
    """写入 outline.md"""
    lines = ["# 大纲\n"]
    for volume in outline:
        vol_name = volume.get("volume", "")
        chapters = volume.get("chapters", [])
        lines.append(f"## {vol_name}\n")
        for ch in chapters:
            num = ch.get("num", 0)
            title = ch.get("title", "")
            lines.append(f"- {num:03d}. {title}")
        lines.append("")

    write_file(OUTLINE_FILE, "\n".join(lines))


def read_outline() -> list:
    """读取 outline.md"""
    content = read_file(OUTLINE_FILE)
    if not content:
        return []

    outline = []
    current_volume = None

    for line in content.split("\n"):
        if line.startswith("## "):
            if current_volume:
                outline.append(current_volume)
            current_volume = {"volume": line[3:].strip(), "chapters": []}
        elif line.startswith("- ") and current_volume:
            # 解析 "001. 标题" 格式
            parts = line[2:].split(". ", 1)
            if len(parts) == 2:
                try:
                    num = int(parts[0])
                    title = parts[1]
                    current_volume["chapters"].append({"num": num, "title": title})
                except ValueError:
                    pass

    if current_volume:
        outline.append(current_volume)

    return outline


def get_chapter_outline(chapter_num: int) -> str | None:
    """获取指定章节的大纲标题"""
    outline = read_outline()
    for volume in outline:
        for ch in volume.get("chapters", []):
            if ch.get("num") == chapter_num:
                return ch.get("title")
    return None
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestOutlineFileOps -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现大纲文件读写"
```

---

### Task 5: 编写 context 文件操作

**Files:**
- Modify: `tests/test_write.py`
- Modify: `novel/write.py`

- [ ] **Step 1: 编写 context 测试**

```python
# 添加到 tests/test_write.py
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestContextFileOps -v
```
Expected: FAIL

- [ ] **Step 3: 实现 context 操作函数**

```python
# 添加到 novel/write.py
def write_context(context: dict) -> None:
    """写入 context.md"""
    lines = ["# 上下文摘要\n"]

    # 当前进度
    current = context.get("current_chapter", 0)
    lines.append(f"## 当前进度\n- 已完成：{current}章\n- 下一章：{current + 1:03d}\n")

    # 剧情摘要
    summaries = context.get("recent_summaries", [])
    if summaries:
        lines.append("## 剧情摘要（最近5章）")
        for s in summaries[-5:]:
            lines.append(s)
        lines.append("")

    # 角色状态
    char_states = context.get("character_states", [])
    if char_states:
        lines.append("## 角色状态")
        for cs in char_states:
            lines.append(f"- {cs}")
        lines.append("")

    # 待埋伏笔
    plots = context.get("pending_plots", [])
    if plots:
        lines.append("## 待埋伏笔")
        for p in plots:
            lines.append(f"- {p}")
        lines.append("")

    write_file(CONTEXT_FILE, "\n".join(lines))


def read_context() -> str:
    """读取 context.md 作为文本（用于 Prompt）"""
    return read_file(CONTEXT_FILE)


def read_context_dict() -> dict:
    """读取 context.md 解析为字典"""
    content = read_file(CONTEXT_FILE)
    if not content:
        return {"current_chapter": 0, "recent_summaries": [],
                "character_states": [], "pending_plots": []}

    result = {
        "current_chapter": 0,
        "recent_summaries": [],
        "character_states": [],
        "pending_plots": []
    }

    current_section = None
    for line in content.split("\n"):
        if line.startswith("## 当前进度"):
            current_section = "progress"
        elif line.startswith("## 剧情摘要"):
            current_section = "summaries"
        elif line.startswith("## 角色状态"):
            current_section = "characters"
        elif line.startswith("## 待埋伏笔"):
            current_section = "plots"
        elif current_section == "progress" and "已完成：" in line:
            try:
                result["current_chapter"] = int(line.split("：")[1].replace("章", ""))
            except (ValueError, IndexError):
                pass
        elif current_section == "summaries" and line.strip():
            result["recent_summaries"].append(line.strip())
        elif current_section == "characters" and line.startswith("- "):
            result["character_states"].append(line[2:])
        elif current_section == "plots" and line.startswith("- "):
            result["pending_plots"].append(line[2:])

    return result
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestContextFileOps -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现上下文文件读写"
```

---

## Chunk 2: Ollama 调用与生成流程

### Task 6: 编写 Ollama generate 函数测试

**Files:**
- Modify: `tests/test_write.py`
- Modify: `novel/write.py`

- [ ] **Step 1: 编写 generate 函数测试（mock Ollama）**

```python
# 添加到 tests/test_write.py
from unittest.mock import patch, MagicMock


class TestOllamaGenerate:
    """测试 Ollama 生成函数"""

    @patch("ollama.chat")
    def test_generate_simple(self, mock_chat):
        """简单生成"""
        mock_chat.return_value = {"message": {"content": "生成的文本"}}

        result = generate("测试提示词")
        assert result == "生成的文本"
        mock_chat.assert_called_once()

    @patch("ollama.chat")
    def test_generate_with_context(self, mock_chat):
        """带上下文生成"""
        mock_chat.return_value = {"message": {"content": "结果"}}

        result = generate("提示词", context="背景信息")
        assert result == "结果"

        # 验证上下文被拼接到 prompt 中
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestOllamaGenerate -v
```
Expected: FAIL

- [ ] **Step 3: 实现 generate 函数**

```python
# 添加到 novel/write.py
import os
import time
import ollama

# 配置
MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:7b")
TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "300"))


def generate(prompt: str, context: str = "", retries: int = 3) -> str:
    """调用 Ollama 生成文本，带重试"""
    full_prompt = f"{context}\n\n{prompt}" if context else prompt

    for attempt in range(retries):
        try:
            response = ollama.chat(
                model=MODEL,
                messages=[{"role": "user", "content": full_prompt}],
                options={"num_ctx": 4096}
            )
            return response["message"]["content"]
        except Exception as e:
            if attempt == retries - 1:
                raise RuntimeError(f"Ollama 调用失败: {e}")
            time.sleep(2 ** attempt)  # 指数退避
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestOllamaGenerate -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现 Ollama 生成函数（带重试）"
```

---

### Task 7: 编写提示词模板

**Files:**
- Modify: `tests/test_write.py`
- Modify: `novel/write.py`

- [ ] **Step 1: 编写提示词模板测试**

```python
# 添加到 tests/test_write.py
class TestPromptTemplates:
    """测试提示词模板"""

    def test_world_prompt(self):
        """世界观提示词"""
        prompt = WORLD_PROMPT.format(genre="玄幻", theme="修仙")
        assert "玄幻" in prompt
        assert "修仙" in prompt
        assert "500-800字" in prompt

    def test_character_prompt(self):
        """角色提示词"""
        prompt = CHARACTER_PROMPT.format(world="测试世界观")
        assert "测试世界观" in prompt
        assert "主角" in prompt

    def test_outline_prompt(self):
        """大纲提示词"""
        prompt = OUTLINE_PROMPT.format(
            world="世界观",
            characters="角色",
            total_chapters=100
        )
        assert "100章" in prompt

    def test_chapter_prompt(self):
        """章节提示词"""
        prompt = CHAPTER_PROMPT.format(
            context="上下文",
            num=1,
            title="测试章节",
            outline_detail="大纲详情",
            words=3000,
            style="玄幻"
        )
        assert "第1章" in prompt
        assert "测试章节" in prompt
        assert "3000字" in prompt
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestPromptTemplates -v
```
Expected: FAIL

- [ ] **Step 3: 实现提示词模板**

```python
# 添加到 novel/write.py
# ========== 提示词模板 ==========

WORLD_PROMPT = """请为一部{genre}类型的小说创建世界观设定。

主题：{theme}
要求：
1. 修炼/能力体系（3-5个等级）
2. 世界背景（势力分布、历史背景）
3. 特色元素（2-3个独特的设定）
4. 字数：500-800字

直接输出世界观内容，不要有标题和额外说明。"""

CHARACTER_PROMPT = """基于以下世界观，创建小说角色：

{world}

要求创建：
1. 主角（1人）：要有独特的金手指或优势
2. 重要配角（2-3人）：与主角有明确关系

每个角色包含：姓名、身份、性格、与主角关系、目标

直接输出角色信息，用列表格式。"""

OUTLINE_PROMPT = """基于以下设定，生成小说大纲：

## 世界观
{world}

## 角色
{characters}

## 要求
- 总章数：{total_chapters}章
- 分卷规划（每卷20-30章）
- 每章一行，格式：章节号. 标题
- 主线清晰，有起承转合

直接输出大纲，按卷分组。"""

CHAPTER_PROMPT = """{context}

## 本章任务
第{num}章：{title}

## 大纲描述
{outline_detail}

## 要求
- 字数：{words}字
- 风格：{style}
- 场景描写细腻，对话生动
- 章末留悬念或转折

直接输出章节正文内容。"""
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestPromptTemplates -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现提示词模板"
```

---

### Task 8: 实现生成流程函数

**Files:**
- Modify: `tests/test_write.py`
- Modify: `novel/write.py`

- [ ] **Step 1: 编写生成流程测试（mock generate）**

```python
# 添加到 tests/test_write.py
class TestGenerationFlow:
    """测试生成流程"""

    @patch("write.generate")
    def test_gen_world(self, mock_gen, tmp_path):
        """生成世界观"""
        os.chdir(tmp_path)

        # 先创建 novel.md
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
            "title": "测试",
            "world": "世界观",
            "characters": "角色",
            "target_chapters": 10
        })

        mock_gen.return_value = """# 大纲

## 第一卷
- 001. 穿越
- 002. 拜师"""

        gen_outline()
        outline = read_outline()
        assert len(outline) > 0
        assert outline[0]["volume"] == "第一卷"
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestGenerationFlow -v
```
Expected: FAIL

- [ ] **Step 3: 实现生成流程函数**

```python
# 添加到 novel/write.py
from datetime import datetime


def gen_world() -> str:
    """生成世界观"""
    novel = read_novel()
    prompt = WORLD_PROMPT.format(
        genre=novel.get("genre", "玄幻"),
        theme=novel.get("theme", "修仙")
    )
    world = generate(prompt)
    novel["world"] = world
    write_novel(novel)
    return world


def gen_character() -> str:
    """生成角色"""
    novel = read_novel()
    prompt = CHARACTER_PROMPT.format(world=novel.get("world", ""))
    characters = generate(prompt)
    novel["characters"] = characters
    write_novel(novel)
    return characters


def gen_outline() -> str:
    """生成大纲"""
    novel = read_novel()
    prompt = OUTLINE_PROMPT.format(
        world=novel.get("world", ""),
        characters=novel.get("characters", ""),
        total_chapters=novel.get("target_chapters", 100)
    )
    outline_text = generate(prompt)
    write_outline(parse_outline_text(outline_text))
    return outline_text


def parse_outline_text(text: str) -> list:
    """解析大纲文本为结构化数据"""
    outline = []
    current_volume = None

    for line in text.split("\n"):
        if line.startswith("## "):
            if current_volume:
                outline.append(current_volume)
            current_volume = {"volume": line[3:].strip(), "chapters": []}
        elif line.startswith("- ") and current_volume:
            parts = line[2:].split(". ", 1)
            if len(parts) == 2:
                try:
                    num = int(parts[0].strip())
                    title = parts[1].strip()
                    current_volume["chapters"].append({"num": num, "title": title})
                except ValueError:
                    pass

    if current_volume:
        outline.append(current_volume)

    return outline
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestGenerationFlow -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现世界观/角色/大纲生成流程"
```

---

### Task 9: 实现章节生成与上下文更新

**Files:**
- Modify: `tests/test_write.py`
- Modify: `novel/write.py`

- [ ] **Step 1: 编写章节生成测试**

```python
# 添加到 tests/test_write.py
class TestChapterGeneration:
    """测试章节生成"""

    @patch("write.generate")
    def test_gen_chapter(self, mock_gen, tmp_path):
        """生成章节"""
        os.chdir(tmp_path)

        # 准备数据
        write_novel({
            "title": "测试",
            "genre": "玄幻",
            "theme": "修仙",
            "words_per_chapter": 3000,
            "world": "测试世界观",
            "characters": "测试角色"
        })
        write_outline([{
            "volume": "第一卷",
            "chapters": [{"num": 1, "title": "穿越"}]
        }])

        mock_gen.return_value = "第一章正文内容..." * 500  # 模拟长文本
        gen_chapter(1)

        # 检查章节文件
        chapter_file = CHAPTERS_DIR / "001-穿越.md"
        assert chapter_file.exists()

    @patch("write.generate")
    def test_update_context_after_chapter(self, mock_gen, tmp_path):
        """写章节后更新上下文"""
        os.chdir(tmp_path)

        mock_gen.side_effect = [
            "章节正文" * 100,  # 章节内容
            "本章摘要：主角穿越到异界"  # 摘要
        ]

        # 初始化
        write_novel({"title": "测试", "genre": "玄幻"})
        write_outline([{"volume": "第一卷", "chapters": [{"num": 1, "title": "测试"}]}])
        write_context({"current_chapter": 0, "recent_summaries": []})

        gen_chapter(1)

        context = read_context_dict()
        assert context["current_chapter"] == 1
        assert len(context["recent_summaries"]) == 1

    @patch("write.generate")
    def test_context_keeps_only_5_summaries(self, mock_gen, tmp_path):
        """上下文只保留最近5章摘要"""
        os.chdir(tmp_path)

        # 模拟已有5章摘要
        write_context({
            "current_chapter": 5,
            "recent_summaries": ["摘要1", "摘要2", "摘要3", "摘要4", "摘要5"]
        })

        mock_gen.side_effect = ["章节内容", "新摘要"]

        write_novel({"title": "测试"})
        write_outline([{"volume": "第一卷", "chapters": [{"num": 6, "title": "测试"}]}])

        gen_chapter(6)

        context = read_context_dict()
        assert len(context["recent_summaries"]) == 5
        assert "摘要1" not in context["recent_summaries"]  # 最早的被移除
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestChapterGeneration -v
```
Expected: FAIL

- [ ] **Step 3: 实现章节生成函数**

```python
# 添加到 novel/write.py
def gen_chapter(chapter_num: int) -> str:
    """生成章节"""
    novel = read_novel()
    context = read_context()
    chapter_title = get_chapter_outline(chapter_num)

    if not chapter_title:
        raise ValueError(f"未找到第 {chapter_num} 章的大纲")

    prompt = CHAPTER_PROMPT.format(
        context=context,
        num=chapter_num,
        title=chapter_title,
        outline_detail=f"第{chapter_num}章：{chapter_title}",
        words=novel.get("words_per_chapter", 3000),
        style=f"{novel.get('genre', '玄幻')}类型，{novel.get('theme', '')}主题"
    )

    content = generate(prompt)
    write_chapter_file(chapter_num, chapter_title, content)
    update_context(chapter_num, content)

    return content


def write_chapter_file(num: int, title: str, content: str) -> None:
    """写入章节文件"""
    CHAPTERS_DIR.mkdir(exist_ok=True)

    meta = {
        "chapter": num,
        "title": title,
        "words": len(content),
        "created": datetime.now().strftime("%Y-%m-%d")
    }

    file_content = build_yaml_front_matter(meta) + f"\n# 第{num}章 {title}\n\n{content}"
    filename = f"{num:03d}-{title[:10]}.md"  # 限制文件名长度

    write_file(CHAPTERS_DIR / filename, file_content)


def update_context(chapter_num: int, new_content: str) -> None:
    """更新上下文"""
    context = read_context_dict()

    # 生成摘要
    try:
        summary = generate(f"请用200字概括以下章节的剧情：\n{new_content[:2000]}")
    except Exception:
        summary = new_content[:200]  # 失败时用原文前200字

    # 更新摘要列表（保留最近5章）
    summaries = context.get("recent_summaries", [])
    summaries.append(f"第{chapter_num}章：{summary}")
    context["recent_summaries"] = summaries[-5:]

    # 更新当前章节
    context["current_chapter"] = chapter_num

    write_context(context)
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestChapterGeneration -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现章节生成与上下文更新"
```

---

## Chunk 3: CLI 入口与集成

### Task 10: 实现 CLI 命令解析

**Files:**
- Modify: `tests/test_write.py`
- Modify: `novel/write.py`

- [ ] **Step 1: 编写 CLI 测试**

```python
# 添加到 tests/test_write.py
import subprocess


class TestCLI:
    """测试命令行接口"""

    def test_cli_new(self, tmp_path):
        """创建新小说"""
        os.chdir(tmp_path)

        result = subprocess.run(
            ["python", "write.py", "new", "测试小说", "--genre", "玄幻", "--theme", "修仙"],
            cwd="novel",
            capture_output=True,
            text=True
        )

        # 检查文件创建
        assert Path("novel/novel.md").exists()

    def test_cli_help(self):
        """帮助信息"""
        result = subprocess.run(
            ["python", "write.py", "--help"],
            cwd="novel",
            capture_output=True,
            text=True
        )
        assert "new" in result.stdout or "usage" in result.stdout.lower()

    def test_cli_status(self, tmp_path):
        """查看状态"""
        os.chdir(tmp_path)

        # 先创建小说
        write_novel({"title": "测试", "genre": "玄幻"})
        write_outline([{"volume": "第一卷", "chapters": [{"num": 1, "title": "测试"}]}])
        write_context({"current_chapter": 0})

        result = subprocess.run(
            ["python", "write.py", "status"],
            cwd="novel",
            capture_output=True,
            text=True
        )
        assert "测试" in result.stdout
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/test_write.py::TestCLI -v
```
Expected: FAIL

- [ ] **Step 3: 实现 CLI 入口**

```python
# 添加到 novel/write.py 末尾
import argparse


def cmd_new(args):
    """创建新小说"""
    data = {
        "title": args.title,
        "genre": args.genre or "xuanhuan",
        "theme": args.theme or "修仙",
        "target_chapters": args.chapters or 100,
        "words_per_chapter": 3000,
        "model": MODEL,
        "created": datetime.now().strftime("%Y-%m-%d")
    }
    write_novel(data)

    # 初始化上下文
    write_context({"current_chapter": 0, "recent_summaries": []})

    print(f"✓ 创建小说: {args.title}")
    print(f"  类型: {data['genre']}, 主题: {data['theme']}")


def cmd_world(args):
    """生成世界观"""
    print("正在生成世界观...")
    world = gen_world()
    print(f"✓ 世界观生成完成 ({len(world)}字)")


def cmd_character(args):
    """生成角色"""
    print("正在生成角色...")
    characters = gen_character()
    print(f"✓ 角色生成完成 ({len(characters)}字)")


def cmd_outline(args):
    """生成大纲"""
    print("正在生成大纲...")
    outline = gen_outline()
    print(f"✓ 大纲生成完成")


def cmd_chapter(args):
    """生成章节"""
    num = args.num
    print(f"正在生成第 {num} 章...")
    content = gen_chapter(num)
    print(f"✓ 第 {num} 章生成完成 ({len(content)}字)")


def cmd_next(args):
    """生成下一章"""
    context = read_context_dict()
    next_num = context.get("current_chapter", 0) + 1
    print(f"正在生成第 {next_num} 章...")
    content = gen_chapter(next_num)
    print(f"✓ 第 {next_num} 章生成完成 ({len(content)}字)")


def cmd_status(args):
    """查看状态"""
    novel = read_novel()
    context = read_context_dict()
    outline = read_outline()

    if not novel:
        print("未找到小说，请先运行: python write.py new")
        return

    print(f"📖 {novel.get('title', '未命名')}")
    print(f"   类型: {novel.get('genre', '-')} | 主题: {novel.get('theme', '-')}")
    print(f"   进度: {context.get('current_chapter', 0)} / {novel.get('target_chapters', '?')} 章")
    print(f"   大纲卷数: {len(outline)}")


def cmd_run(args):
    """一键全流程"""
    print("=== 开始完整创作流程 ===")

    print("\n[1/5] 生成世界观...")
    gen_world()

    print("\n[2/5] 生成角色...")
    gen_character()

    print("\n[3/5] 生成大纲...")
    gen_outline()

    print("\n[4/5] 生成第一章...")
    gen_chapter(1)

    print("\n[5/5] 完成！")
    print("运行 'python write.py next' 继续生成后续章节")


def main():
    parser = argparse.ArgumentParser(description="极简本地小说创作系统")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    # new
    p_new = subparsers.add_parser("new", help="创建新小说")
    p_new.add_argument("title", help="小说标题")
    p_new.add_argument("--genre", "-g", help="类型")
    p_new.add_argument("--theme", "-t", help="主题")
    p_new.add_argument("--chapters", "-c", type=int, help="目标章节数")
    p_new.set_defaults(func=cmd_new)

    # world
    p_world = subparsers.add_parser("world", help="生成世界观")
    p_world.set_defaults(func=cmd_world)

    # character
    p_char = subparsers.add_parser("character", help="生成角色")
    p_char.set_defaults(func=cmd_character)

    # outline
    p_outline = subparsers.add_parser("outline", help="生成大纲")
    p_outline.set_defaults(func=cmd_outline)

    # chapter
    p_chapter = subparsers.add_parser("chapter", help="生成指定章节")
    p_chapter.add_argument("num", type=int, help="章节号")
    p_chapter.set_defaults(func=cmd_chapter)

    # next
    p_next = subparsers.add_parser("next", help="生成下一章")
    p_next.set_defaults(func=cmd_next)

    # status
    p_status = subparsers.add_parser("status", help="查看状态")
    p_status.set_defaults(func=cmd_status)

    # run
    p_run = subparsers.add_parser("run", help="一键全流程")
    p_run.set_defaults(func=cmd_run)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    args.func(args)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pytest tests/test_write.py::TestCLI -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add novel/write.py tests/test_write.py
git commit -m "feat(novel): 实现 CLI 命令入口"
```

---

### Task 11: 集成测试

**Files:**
- Modify: `tests/test_write.py`

- [ ] **Step 1: 编写端到端测试（可选，需要真实 Ollama）**

```python
# 添加到 tests/test_write.py
import pytest


@pytest.mark.integration
class TestIntegration:
    """集成测试（需要运行 Ollama）"""

    @pytest.mark.skip(reason="需要真实 Ollama 环境")
    def test_full_flow(self, tmp_path):
        """完整流程测试"""
        os.chdir(tmp_path)

        # 创建小说
        cmd_new(type("Args", (), {
            "title": "集成测试小说",
            "genre": "xuanhuan",
            "theme": "测试",
            "chapters": 3
        }))

        # 生成世界观
        world = gen_world()
        assert len(world) > 100

        # 生成角色
        characters = gen_character()
        assert len(characters) > 50

        # 生成大纲
        gen_outline()
        outline = read_outline()
        assert len(outline) > 0

        # 生成第一章
        content = gen_chapter(1)
        assert len(content) > 500

        # 验证上下文更新
        context = read_context_dict()
        assert context["current_chapter"] == 1
```

- [ ] **Step 2: 运行所有测试**

```bash
pytest tests/test_write.py -v --ignore-glob="*integration*"
```
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add tests/test_write.py
git commit -m "test(novel): 添加集成测试占位"
```

---

### Task 12: 最终检查与文档

**Files:**
- Create: `novel/README.md`

- [ ] **Step 1: 运行全部测试**

```bash
pytest tests/test_write.py -v
```
Expected: 全部 PASS

- [ ] **Step 2: 检查代码行数**

```bash
wc -l novel/write.py
```
Expected: < 450 行

- [ ] **Step 3: 编写使用说明**

```markdown
# novel/README.md

# 极简本地小说创作系统

## 快速开始

```bash
# 安装依赖
pip install -r requirements-novel.txt

# 创建新小说
python write.py new "修仙传奇" --genre xuanhuan --theme "逆天改命"

# 一键生成（世界观→角色→大纲→第一章）
python write.py run

# 继续生成下一章
python write.py next

# 生成指定章节
python write.py chapter 5

# 查看状态
python write.py status
```

## 环境变量

- `OLLAMA_MODEL`: 模型名称（默认 deepseek-r1:7b）
- `OLLAMA_TIMEOUT`: 超时时间（默认 300秒）
```

- [ ] **Step 4: 最终提交**

```bash
git add novel/README.md
git commit -m "docs(novel): 添加使用说明"
```

---

## 完成检查

- [ ] 所有测试通过
- [ ] 代码行数 < 450
- [ ] 能完成完整流程（世界观→角色→大纲→章节）
- [ ] 文件可手动编辑
