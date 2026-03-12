"""YAML front matter 解析与构建模块"""

import shutil
import yaml
from pathlib import Path
from typing import Tuple, Optional


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
        world_section = body.split("# 世界观")[1].split("#")[0].strip()
        result["world"] = world_section
    if "# 角色" in body:
        char_section = body.split("# 角色")[1].split("#")[0].strip()
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
