# Novel-Lite 代码重构设计

## 目标

提高 `novel-lite/write.py` 的可读性，通过模块化拆分使结构更清晰。

## 范围

- **功能保留**：`new`、`outline`、`write` 三个核心命令
- **模块化**：拆分为 5 个文件
- **测试**：简化测试，聚焦核心功能

## 命令映射

| 原命令 | 新命令 | 说明 |
|--------|--------|------|
| `new` | `new` | 保持不变 |
| `world` + `character` | `outline` | 合并为大纲生成的前置步骤 |
| `outline` | `outline` | 保持不变 |
| `chapter` + `next` | `write` | 合并为写下一章 |
| `status` | - | 废弃，信息可通过查看文件获得 |
| `run` | - | 废弃，用户可手动执行各步骤 |

## 模块设计

### 1. config.yaml（配置文件）
用户可编辑的配置文件。

```yaml
model: deepseek-r1:7b
timeout: 300
data_dir: novel-lite

prompts:
  world: |
    请为一部{genre}类型的小说创建世界观设定...
  character: |
    基于以下世界观，创建小说角色...
  outline: |
    基于以下设定，生成小说大纲...
  chapter: |
    {context}
    ## 本章任务...
```

### 2. config.py（约20行）
读取配置文件，支持环境变量覆盖。

```python
import os
import yaml
from pathlib import Path

def load_config() -> dict:
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path) as f:
        config = yaml.safe_load(f)
    # 环境变量覆盖
    if os.getenv("OLLAMA_MODEL"):
        config["model"] = os.getenv("OLLAMA_MODEL")
    if os.getenv("OLLAMA_TIMEOUT"):
        config["timeout"] = int(os.getenv("OLLAMA_TIMEOUT"))
    return config

CONFIG = load_config()
```

### 3. files.py（约100行）
文件操作工具，封装文件IO和YAML处理。

```python
from pathlib import Path
import shutil
import yaml

# 路径常量
NOVEL_FILE = Path("novel.md")
OUTLINE_FILE = Path("outline.md")
CONTEXT_FILE = Path("context.md")
CHAPTERS_DIR = Path("chapters")

# 基础操作
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

def parse_yaml_front_matter(content: str, return_body: bool = False) -> dict | tuple:
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

# 小说文件操作
def write_novel(data: dict) -> None:
    """写入 novel.md，包含元信息和世界观、角色"""

def read_novel() -> dict:
    """读取 novel.md，返回完整数据字典"""

def write_outline(outline: list) -> None:
    """写入 outline.md"""

def read_outline() -> list:
    """读取 outline.md，返回章节列表"""

def get_chapter_outline(chapter_num: int) -> str | None:
    """获取指定章节的大纲标题"""

# 上下文操作
def write_context(context: dict) -> None:
    """写入 context.md"""

def read_context() -> str:
    """读取 context.md 作为文本"""

def read_context_dict() -> dict:
    """读取 context.md 解析为字典"""

# 解析工具
def parse_outline_text(text: str) -> list:
    """解析大纲文本为结构化数据"""
```

### 4. ai.py（约30行）
AI调用封装，处理Ollama交互，保留重试机制。

```python
import ollama
import time
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

### 5. core.py（约120行）
小说核心逻辑，封装状态和操作。

```python
from pathlib import Path
from datetime import datetime
from config import CONFIG
from files import *
from ai import generate

class Novel:
    """小说创作管理类"""

    def __init__(self, path: Path = None):
        """初始化，path 为小说目录，默认当前目录"""

    # === 公共命令 ===

    def create(self, title: str, genre: str = "xuanhuan",
               theme: str = "修仙", chapters: int = 100) -> None:
        """创建新小说，生成 novel.md 和 context.md"""
        # 写入 novel.md 元信息
        # 写入 context.md 初始状态

    def generate_outline(self) -> None:
        """生成完整大纲，依次执行：世界观 → 角色 → 章节列表"""
        self._gen_world()
        self._gen_characters()
        self._gen_outline()

    def write_chapter(self) -> int:
        """撰写下一章，自动获取当前进度+1，返回章节号"""
        chapter_num = self._get_next_chapter_num()
        # 生成章节内容
        # 写入章节文件
        # 更新上下文
        return chapter_num

    # === 内部方法 ===

    def _get_next_chapter_num(self) -> int:
        """获取下一章章节号"""
        # 从 context 获取当前进度 + 1

    def _gen_world(self) -> str:
        """生成世界观，返回生成内容，同时更新 novel.md"""
        # 调用 AI 生成
        # 更新 novel.md

    def _gen_characters(self) -> str:
        """生成角色，返回生成内容，同时更新 novel.md"""

    def _gen_outline(self) -> str:
        """生成章节大纲，写入 outline.md"""
```

### 6. cli.py（约50行）
命令行入口，解析参数并调用Novel类。

```python
import argparse
from core import Novel

def main():
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
            print("正在生成大纲...")
            novel.generate_outline()
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

### 7. write.py（入口点）
保留为兼容入口，仅导入cli。

```python
from cli import main
if __name__ == "__main__":
    main()
```

## 文件结构

```
novel-lite/
├── config.yaml      # 配置文件（用户可编辑）
├── config.py        # 读取配置
├── files.py         # 文件操作
├── ai.py            # AI调用
├── core.py          # 核心逻辑
├── cli.py           # 命令行入口
├── write.py         # 兼容入口点
└── README.md        # 使用说明
```

## 测试设计

### 测试结构
```
tests/novel_lite/
├── test_files.py    # 测试文件操作（约80行）
└── test_core.py     # 测试核心逻辑（约100行）
```

### test_files.py 核心场景
- `test_write_and_read_file`: 文件写入和读取
- `test_yaml_front_matter_parse`: YAML 解析
- `test_yaml_front_matter_build`: YAML 构建
- `test_read_novel`: 读取小说数据
- `test_read_outline`: 读取大纲数据
- `test_read_context_dict`: 读取上下文字典

### test_core.py 核心场景
- `test_novel_create`: 创建小说（mock ai.generate）
- `test_novel_generate_outline`: 生成大纲（mock ai.generate）
- `test_novel_write_chapter`: 撰写章节（mock ai.generate）
- `test_get_next_chapter_num`: 获取下一章号

### Mock 策略
- 所有测试 mock `ai.generate` 函数，返回固定文本
- 不依赖真实的 Ollama 服务

## 命令行接口

```bash
# 创建新小说
python write.py new "书名" --genre xuanhuan --theme 修仙 --chapters 100

# 生成大纲（自动包含世界观和角色）
python write.py outline

# 撰写下一章
python write.py write
```

## 数据流

```
new      → novel.md（元信息）
         → context.md（进度追踪）

outline  → novel.md（追加世界观、角色）
         → outline.md（章节列表）

write    → chapters/001-标题.md, 002-标题.md...
         → context.md（更新进度和摘要）
```

## 模块依赖关系

```
cli.py → core.py → ai.py
               ↘ files.py
               ↗ config.py
```

## 不在范围内

- 自动发布功能
- API和看板功能
- `status`、`run` 等辅助命令
- 详细错误处理和日志系统
