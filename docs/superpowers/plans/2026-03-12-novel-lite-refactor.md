# Novel-Lite 代码重构实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 novel-lite/write.py 重构为模块化结构，提高可读性

**Architecture:** 按职责拆分为 5 个模块：config（配置）、files（文件操作）、ai（AI调用）、core（核心逻辑）、cli（命令行）

**Tech Stack:** Python 3.10+, ollama, yaml, argparse

---

## 文件结构

```
novel-lite/
├── config.yaml      # 新建 - 配置文件
├── config.py        # 新建 - 读取配置
├── files.py         # 新建 - 文件操作
├── ai.py            # 新建 - AI调用
├── core.py          # 新建 - 核心逻辑
├── cli.py           # 新建 - 命令行入口
├── write.py         # 修改 - 简化为入口
└── README.md        # 更新 - 使用说明

tests/novel_lite/
├── __init__.py      # 新建
├── test_files.py    # 新建 - 文件操作测试
└── test_core.py     # 新建 - 核心逻辑测试
```

---

## Chunk 1: 配置模块

### Task 1: 创建 config.yaml

**Files:**
- Create: `novel-lite/config.yaml`

- [ ] **Step 1: 创建配置文件**

```yaml
model: deepseek-r1:7b
timeout: 300

prompts:
  world: |
    请为一部{genre}类型的小说创建世界观设定。
    主题：{theme}
    要求：
    1. 修炼/能力体系（3-5个等级）
    2. 世界背景（势力分布、历史背景）
    3. 特色元素（2-3个独特的设定）
    4. 字数：500-800字
    直接输出世界观内容，不要有标题和额外说明。
  character: |
    基于以下世界观，创建小说角色：
    {world}
    要求创建：
    1. 主角（1人）：要有独特的金手指或优势
    2. 重要配角（2-3人）：与主角有明确关系
    每个角色包含：姓名、身份、性格、与主角关系、目标
    直接输出角色信息，用列表格式。
  outline: |
    基于以下设定，生成小说大纲：
    ## 世界观
    {world}
    ## 角色
    {characters}
    ## 要求
    - 总章数：{total_chapters}章
    - 分卷规划（每卷20-30章）
    - 每章一行，格式：章节号. 标题
    - 主线清晰，有起承转合
    直接输出大纲，按卷分组。
  chapter: |
    {context}
    ## 本章任务
    第{num}章：{title}
    ## 大纲描述
    {outline_detail}
    ## 要求
    - 字数：{words}字
    - 风格：{style}
    - 场景描写细腻，对话生动
    - 章末留悬念或转折
    直接输出章节正文内容。
```

- [ ] **Step 2: 提交配置文件**

```bash
git add novel-lite/config.yaml
git commit -m "feat(novel-lite): 添加配置文件 config.yaml"
```

### Task 2: 创建 config.py

**Files:**
- Create: `novel-lite/config.py`

- [ ] **Step 1: 创建配置读取模块**

```python
"""配置管理模块"""

import os
from pathlib import Path

import yaml


def load_config() -> dict:
    """加载配置文件，支持环境变量覆盖"""
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    # 环境变量覆盖
    if os.getenv("OLLAMA_MODEL"):
        config["model"] = os.getenv("OLLAMA_MODEL")
    if os.getenv("OLLAMA_TIMEOUT"):
        config["timeout"] = int(os.getenv("OLLAMA_TIMEOUT"))

    return config


CONFIG = load_config()
```

- [ ] **Step 2: 提交配置模块**

```bash
git add novel-lite/config.py
git commit -m "feat(novel-lite): 添加配置读取模块 config.py"
```

---

## Chunk 2: 文件操作模块

### Task 3: 创建 files.py 基础操作

**Files:**
- Create: `novel-lite/files.py`
- Create: `tests/novel_lite/__init__.py`
- Create: `tests/novel_lite/test_files.py`

- [ ] **Step 1: 写基础文件操作测试**

```python
# tests/novel_lite/test_files.py
"""文件操作模块测试"""

import tempfile
from pathlib import Path

import pytest

# 将在下一步实现
from files import read_file, write_file, parse_yaml_front_matter, build_yaml_front_matter


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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd novel-lite && python -m pytest ../tests/novel_lite/test_files.py -v
```

Expected: FAIL (ModuleNotFoundError: No module named 'files')

- [ ] **Step 3: 实现 files.py 基础操作**

```python
# novel-lite/files.py
"""文件操作模块"""

import shutil
from pathlib import Path

import yaml

# 路径常量
NOVEL_FILE = Path("novel.md")
OUTLINE_FILE = Path("outline.md")
CONTEXT_FILE = Path("context.md")
CHAPTERS_DIR = Path("chapters")


def write_file(path: Path, content: str) -> None:
    """原子写入文件，带备份"""
    if path.exists():
        shutil.copy(path, Path(str(path) + ".bak"))
    tmp = Path(str(path) + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.rename(path)


def read_file(path: Path) -> str:
    """读取文件内容"""
    return path.read_text(encoding="utf-8") if path.exists() else ""


def parse_yaml_front_matter(content: str, return_body: bool = False) -> dict | tuple[dict, str]:
    """解析 YAML front matter"""
    if not content.startswith("---\n"):
        return ({}, content) if return_body else {}
    parts = content.split("---\n", 2)
    if len(parts) < 3:
        return ({}, content) if return_body else {}
    data = yaml.safe_load(parts[1]) or {}
    return (data, parts[2].strip()) if return_body else data


def build_yaml_front_matter(data: dict) -> str:
    """构建 YAML front matter"""
    return f"---\n{yaml.dump(data, allow_unicode=True, default_flow_style=False)}---\n"
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd novel-lite && python -m pytest ../tests/novel_lite/test_files.py::TestBasicFileOps -v
cd novel-lite && python -m pytest ../tests/novel_lite/test_files.py::TestYamlFrontMatter -v
```

Expected: PASS

- [ ] **Step 5: 提交基础文件操作**

```bash
git add novel-lite/files.py tests/novel_lite/__init__.py tests/novel_lite/test_files.py
git commit -m "feat(novel-lite): 添加文件操作基础模块和测试"
```

### Task 4: 添加小说文件操作函数

**Files:**
- Modify: `novel-lite/files.py`
- Modify: `tests/novel_lite/test_files.py`

- [ ] **Step 1: 写小说文件操作测试**

```python
# 添加到 tests/novel_lite/test_files.py

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

        from files import write_novel, read_novel
        write_novel(data)
        result = read_novel()

        assert result["title"] == "测试小说"
        assert result["genre"] == "xuanhuan"
        assert "修仙世界" in result.get("world", "")

    def test_read_novel_empty(self, tmp_path: Path, monkeypatch):
        """测试读取空小说"""
        monkeypatch.chdir(tmp_path)

        from files import read_novel
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

        from files import write_outline, read_outline
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

        from files import write_context, read_context_dict
        write_context(context)
        result = read_context_dict()

        assert result["current_chapter"] == 5
        assert len(result["recent_summaries"]) == 2
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd novel-lite && python -m pytest ../tests/novel_lite/test_files.py::TestNovelFileOps -v
```

Expected: FAIL

- [ ] **Step 3: 添加小说文件操作函数到 files.py**

```python
# 添加到 novel-lite/files.py 末尾

def write_novel(data: dict) -> None:
    """写入 novel.md"""
    meta_keys = ["title", "genre", "theme", "target_chapters", "words_per_chapter", "model", "created"]
    meta = {k: v for k, v in data.items() if k in meta_keys}
    body_parts = []
    if "world" in data:
        body_parts.append(f"# 世界观\n\n{data['world']}")
    if "characters" in data:
        body_parts.append(f"# 角色\n\n{data['characters']}")
    write_file(NOVEL_FILE, build_yaml_front_matter(meta) + "\n" + "\n\n".join(body_parts))


def read_novel() -> dict:
    """读取 novel.md"""
    content = read_file(NOVEL_FILE)
    if not content:
        return {}
    meta, body = parse_yaml_front_matter(content, return_body=True)
    result = dict(meta)
    if "# 世界观" in body:
        result["world"] = body.split("# 世界观")[1].split("\n# ")[0].strip()
    if "# 角色" in body:
        result["characters"] = body.split("# 角色")[1].split("\n# ")[0].strip()
    return result


def write_outline(outline: list) -> None:
    """写入 outline.md"""
    lines = ["# 大纲\n"]
    for volume in outline:
        lines.append(f"## {volume.get('volume', '')}\n")
        for ch in volume.get("chapters", []):
            lines.append(f"- {ch.get('num', 0):03d}. {ch.get('title', '')}")
        lines.append("")
    write_file(OUTLINE_FILE, "\n".join(lines))


def read_outline() -> list:
    """读取 outline.md"""
    content = read_file(OUTLINE_FILE)
    if not content:
        return []
    outline, current_volume = [], None
    for line in content.split("\n"):
        if line.startswith("## "):
            if current_volume:
                outline.append(current_volume)
            current_volume = {"volume": line[3:].strip(), "chapters": []}
        elif line.startswith("- ") and current_volume:
            parts = line[2:].split(". ", 1)
            if len(parts) == 2:
                try:
                    current_volume["chapters"].append({"num": int(parts[0]), "title": parts[1]})
                except ValueError:
                    pass
    if current_volume:
        outline.append(current_volume)
    return outline


def get_chapter_outline(chapter_num: int) -> str | None:
    """获取指定章节的大纲标题"""
    for volume in read_outline():
        for ch in volume.get("chapters", []):
            if ch.get("num") == chapter_num:
                return ch.get("title")
    return None


def write_context(context: dict) -> None:
    """写入 context.md"""
    lines = [f"# 上下文摘要\n\n## 当前进度\n- 已完成：{context.get('current_chapter', 0)}章\n"]
    if context.get("recent_summaries"):
        lines.append("## 剧情摘要（最近5章）\n" + "\n".join(context["recent_summaries"][-5:]) + "\n")
    if context.get("character_states"):
        lines.append("## 角色状态\n" + "\n".join(f"- {s}" for s in context["character_states"]) + "\n")
    if context.get("pending_plots"):
        lines.append("## 待埋伏笔\n" + "\n".join(f"- {p}" for p in context["pending_plots"]) + "\n")
    write_file(CONTEXT_FILE, "\n".join(lines))


def read_context() -> str:
    """读取 context.md 作为文本"""
    return read_file(CONTEXT_FILE)


def read_context_dict() -> dict:
    """读取 context.md 解析为字典"""
    content = read_file(CONTEXT_FILE)
    result = {"current_chapter": 0, "recent_summaries": [], "character_states": [], "pending_plots": []}
    if not content:
        return result
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


def parse_outline_text(text: str) -> list:
    """解析大纲文本为结构化数据"""
    outline, current_volume = [], None
    for line in text.split("\n"):
        if line.startswith("## "):
            if current_volume:
                outline.append(current_volume)
            current_volume = {"volume": line[3:].strip(), "chapters": []}
        elif line.startswith("- ") and current_volume:
            parts = line[2:].split(". ", 1)
            if len(parts) == 2:
                try:
                    current_volume["chapters"].append({"num": int(parts[0].strip()), "title": parts[1].strip()})
                except ValueError:
                    pass
    if current_volume:
        outline.append(current_volume)
    return outline
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd novel-lite && python -m pytest ../tests/novel_lite/test_files.py -v
```

Expected: PASS

- [ ] **Step 5: 提交小说文件操作**

```bash
git add novel-lite/files.py tests/novel_lite/test_files.py
git commit -m "feat(novel-lite): 添加小说文件操作函数和测试"
```

---

## Chunk 3: AI 调用模块

### Task 5: 创建 ai.py

**Files:**
- Create: `novel-lite/ai.py`

- [ ] **Step 1: 创建 AI 调用模块**

```python
# novel-lite/ai.py
"""AI 调用模块"""

import time

import ollama

from config import CONFIG


def generate(prompt: str, context: str = "", retries: int = 3) -> str:
    """调用 Ollama 生成文本，带重试"""
    full_prompt = f"{context}\n\n{prompt}" if context else prompt
    for attempt in range(retries):
        try:
            response = ollama.chat(
                model=CONFIG["model"],
                messages=[{"role": "user", "content": full_prompt}],
                options={"num_ctx": 4096}
            )
            return response["message"]["content"]
        except Exception as e:
            if attempt == retries - 1:
                raise RuntimeError(f"Ollama 调用失败: {e}")
            time.sleep(2 ** attempt)
```

- [ ] **Step 2: 提交 AI 模块**

```bash
git add novel-lite/ai.py
git commit -m "feat(novel-lite): 添加 AI 调用模块 ai.py"
```

---

## Chunk 4: 核心逻辑模块

### Task 6: 创建 core.py

**Files:**
- Create: `novel-lite/core.py`
- Create: `tests/novel_lite/test_core.py`

- [ ] **Step 1: 写核心逻辑测试**

```python
# tests/novel_lite/test_core.py
"""核心逻辑模块测试"""

from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest


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

    @patch("ai.generate")
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

    @patch("ai.generate")
    def test_generate_outline_sequence(self, mock_generate, tmp_path: Path, monkeypatch):
        """测试大纲生成顺序"""
        monkeypatch.chdir(tmp_path)

        call_order = []
        mock_generate.side_effect = lambda prompt, **kwargs: (
            call_order.append("world") if "世界观" in prompt else
            call_order.append("character") if "角色" in prompt else
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

    @patch("ai.generate")
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd novel-lite && python -m pytest ../tests/novel_lite/test_core.py -v
```

Expected: FAIL

- [ ] **Step 3: 实现 core.py**

```python
# novel-lite/core.py
"""核心逻辑模块"""

from datetime import datetime
from pathlib import Path

from ai import generate
from config import CONFIG
from files import (
    NOVEL_FILE, OUTLINE_FILE, CONTEXT_FILE, CHAPTERS_DIR,
    read_novel, write_novel, read_outline, write_outline,
    read_context, write_context, read_context_dict,
    get_chapter_outline, parse_outline_text, build_yaml_front_matter, write_file
)


class Novel:
    """小说创作管理类"""

    def __init__(self, path: Path = None):
        """初始化，path 为小说目录，默认当前目录"""
        self.path = path or Path.cwd()

    def create(self, title: str, genre: str = "xuanhuan",
               theme: str = "修仙", chapters: int = 100) -> None:
        """创建新小说，生成 novel.md 和 context.md"""
        data = {
            "title": title,
            "genre": genre,
            "theme": theme,
            "target_chapters": chapters,
            "words_per_chapter": 3000,
            "model": CONFIG["model"],
            "created": datetime.now().strftime("%Y-%m-%d")
        }
        write_novel(data)
        write_context({"current_chapter": 0, "recent_summaries": []})

    def generate_outline(self) -> None:
        """生成完整大纲，依次执行：世界观 → 角色 → 章节列表"""
        self._gen_world()
        self._gen_characters()
        self._gen_outline()

    def write_chapter(self) -> int:
        """撰写下一章，自动获取当前进度+1，返回章节号"""
        chapter_num = self._get_next_chapter_num()
        self._gen_chapter(chapter_num)
        return chapter_num

    def _get_next_chapter_num(self) -> int:
        """获取下一章章节号"""
        ctx = read_context_dict()
        return ctx.get("current_chapter", 0) + 1

    def _gen_world(self) -> str:
        """生成世界观，返回生成内容，同时更新 novel.md"""
        novel = read_novel()
        prompt = CONFIG["prompts"]["world"].format(
            genre=novel.get("genre", "玄幻"),
            theme=novel.get("theme", "修仙")
        )
        world = generate(prompt)
        novel["world"] = world
        write_novel(novel)
        return world

    def _gen_characters(self) -> str:
        """生成角色，返回生成内容，同时更新 novel.md"""
        novel = read_novel()
        prompt = CONFIG["prompts"]["character"].format(
            world=novel.get("world", "")
        )
        characters = generate(prompt)
        novel["characters"] = characters
        write_novel(novel)
        return characters

    def _gen_outline(self) -> str:
        """生成章节大纲，写入 outline.md"""
        novel = read_novel()
        prompt = CONFIG["prompts"]["outline"].format(
            world=novel.get("world", ""),
            characters=novel.get("characters", ""),
            total_chapters=novel.get("target_chapters", 100)
        )
        outline_text = generate(prompt)
        write_outline(parse_outline_text(outline_text))
        return outline_text

    def _gen_chapter(self, chapter_num: int) -> str:
        """生成章节"""
        novel = read_novel()
        chapter_title = get_chapter_outline(chapter_num)
        if not chapter_title:
            raise ValueError(f"未找到第 {chapter_num} 章的大纲")

        prompt = CONFIG["prompts"]["chapter"].format(
            context=read_context(),
            num=chapter_num,
            title=chapter_title,
            outline_detail=f"第{chapter_num}章：{chapter_title}",
            words=novel.get("words_per_chapter", 3000),
            style=f"{novel.get('genre', '玄幻')}类型，{novel.get('theme', '')}主题"
        )
        content = generate(prompt)

        # 写入章节文件
        CHAPTERS_DIR.mkdir(exist_ok=True)
        meta = {
            "chapter": chapter_num,
            "title": chapter_title,
            "words": len(content),
            "created": datetime.now().strftime("%Y-%m-%d")
        }
        write_file(
            CHAPTERS_DIR / f"{chapter_num:03d}-{chapter_title[:10]}.md",
            build_yaml_front_matter(meta) + f"\n# 第{chapter_num}章 {chapter_title}\n\n{content}"
        )

        # 更新上下文
        ctx = read_context_dict()
        try:
            summary = generate(f"请用200字概括以下章节的剧情：\n{content[:2000]}")
        except Exception:
            summary = content[:200]
        ctx["recent_summaries"] = (ctx.get("recent_summaries", []) + [f"第{chapter_num}章：{summary}"])[-5:]
        ctx["current_chapter"] = chapter_num
        write_context(ctx)

        return content
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd novel-lite && python -m pytest ../tests/novel_lite/test_core.py -v
```

Expected: PASS

- [ ] **Step 5: 提交核心逻辑模块**

```bash
git add novel-lite/core.py tests/novel_lite/test_core.py
git commit -m "feat(novel-lite): 添加核心逻辑模块 core.py 和测试"
```

---

## Chunk 5: CLI 模块和入口

### Task 7: 创建 cli.py

**Files:**
- Create: `novel-lite/cli.py`

- [ ] **Step 1: 创建 CLI 模块**

```python
# novel-lite/cli.py
"""命令行入口模块"""

import argparse
from pathlib import Path

from core import Novel


def main():
    """命令行主入口"""
    parser = argparse.ArgumentParser(description="极简本地小说创作系统")
    subparsers = parser.add_subparsers(dest="command")

    # new 命令
    p_new = subparsers.add_parser("new", help="创建新小说")
    p_new.add_argument("title", help="小说标题")
    p_new.add_argument("--genre", "-g", default="xuanhuan", help="类型")
    p_new.add_argument("--theme", "-t", default="修仙", help="主题")
    p_new.add_argument("--chapters", "-c", type=int, default=100, help="目标章节数")

    # outline 命令
    subparsers.add_parser("outline", help="生成大纲（含世界观、角色）")

    # write 命令
    subparsers.add_parser("write", help="撰写下一章")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    novel = Novel()

    try:
        if args.command == "new":
            novel.create(args.title, args.genre, args.theme, args.chapters)
            print(f"✓ 创建小说: {args.title}")
        elif args.command == "outline":
            if not Path("novel.md").exists():
                print("✗ 请先创建小说: python write.py new <书名>")
                return
            print("正在生成世界观...")
            novel._gen_world()
            print("正在生成角色...")
            novel._gen_characters()
            print("正在生成大纲...")
            novel._gen_outline()
            print("✓ 大纲生成完成")
        elif args.command == "write":
            if not Path("outline.md").exists():
                print("✗ 请先生成大纲: python write.py outline")
                return
            num = novel.write_chapter()
            print(f"✓ 第 {num} 章生成完成")
    except Exception as e:
        print(f"✗ 错误: {e}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 提交 CLI 模块**

```bash
git add novel-lite/cli.py
git commit -m "feat(novel-lite): 添加命令行模块 cli.py"
```

### Task 8: 简化 write.py

**Files:**
- Modify: `novel-lite/write.py`

- [ ] **Step 1: 简化 write.py 为入口**

```python
# novel-lite/write.py
"""极简本地小说创作系统 - 入口点"""

from cli import main

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 验证 CLI 功能**

```bash
cd novel-lite && python write.py --help
```

Expected: 显示帮助信息

- [ ] **Step 3: 提交简化后的入口**

```bash
git add novel-lite/write.py
git commit -m "refactor(novel-lite): 简化 write.py 为入口点"
```

---

## Chunk 6: 文档更新和清理

### Task 9: 更新 README.md

**Files:**
- Modify: `novel-lite/README.md`

- [ ] **Step 1: 更新 README**

更新 `novel-lite/README.md`，反映新的命令结构：

```markdown
# 极简本地小说创作系统

基于 Ollama 的本地小说创作工具。

## 安装

```bash
pip install ollama pyyaml
```

## 使用

```bash
# 创建新小说
python write.py new "书名" --genre xuanhuan --theme 修仙 --chapters 100

# 生成大纲（自动包含世界观和角色）
python write.py outline

# 撰写下一章
python write.py write
```

## 配置

编辑 `config.yaml` 可修改：
- `model`: Ollama 模型名称
- `prompts`: 各类提示词模板

环境变量覆盖：
- `OLLAMA_MODEL`: 覆盖模型配置
- `OLLAMA_TIMEOUT`: 覆盖超时配置

## 文件结构

```
├── novel.md      # 小说元信息和设定
├── outline.md    # 章节大纲
├── context.md    # 创作上下文
└── chapters/     # 章节文件
```
```

- [ ] **Step 2: 提交文档更新**

```bash
git add novel-lite/README.md
git commit -m "docs(novel-lite): 更新 README 反映新命令结构"
```

### Task 10: 运行完整测试

- [ ] **Step 1: 运行所有测试**

```bash
cd novel-lite && python -m pytest ../tests/novel_lite/ -v
```

Expected: 所有测试通过

- [ ] **Step 2: 最终提交**

```bash
git add -A
git commit -m "feat(novel-lite): 完成代码重构，模块化拆分完成"
```

---

## 完成检查

- [ ] 所有测试通过
- [ ] `python write.py new` 正常工作
- [ ] `python write.py outline` 正常工作
- [ ] `python write.py write` 正常工作
- [ ] README 已更新
