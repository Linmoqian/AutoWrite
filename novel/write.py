"""YAML front matter 解析与构建模块"""

import os
import time
import shutil
import yaml
from datetime import datetime
from pathlib import Path
from typing import Tuple, Optional

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


NOVEL_FILE = Path("novel.md")
OUTLINE_FILE = Path("outline.md")
CONTEXT_FILE = Path("context.md")
CHAPTERS_DIR = Path("chapters")


def write_file(path: Path, content: str) -> None:
    """原子写入文件，带备份"""
    if path.exists():
        backup = Path(str(path) + ".bak")
        shutil.copy(path, backup)
    tmp = Path(str(path) + ".tmp")
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
        world_section = body.split("# 世界观")[1].split("\n# ")[0].strip()
        result["world"] = world_section
    if "# 角色" in body:
        char_section = body.split("# 角色")[1].split("\n# ")[0].strip()
        result["characters"] = char_section

    return result


def parse_yaml_front_matter(content: str, return_body: bool = False) -> dict | Tuple[dict, str]:
    """解析 Markdown 文件中的 YAML front matter

    Args:
        content: Markdown 文件内容
        return_body: 是否同时返回正文内容

    Returns:
        如果 return_body=False: 返回解析后的 YAML 数据字典
        如果 return_body=True: 返回 (数据字典, 正文内容) 元组
    """
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
    """构建 YAML front matter 字符串

    Args:
        data: 要序列化的数据字典

    Returns:
        格式化的 YAML front matter 字符串
    """
    yaml_str = yaml.dump(data, allow_unicode=True, default_flow_style=False)
    return f"---\n{yaml_str}---\n"


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


# ========== 生成流程函数 ==========

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
