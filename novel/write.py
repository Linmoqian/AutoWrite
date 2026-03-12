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
