"""文件操作模块"""

import re
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


def _extract_section(body: str, heading: str) -> str:
    """安全提取 Markdown 章节内容"""
    marker = f"# {heading}"
    if marker not in body:
        return ""
    part = body.split(marker, 1)[1]
    next_h = part.find("\n# ")
    return part[:next_h].strip() if next_h != -1 else part.strip()


def read_novel() -> dict:
    """读取 novel.md"""
    content = read_file(NOVEL_FILE)
    if not content:
        return {}
    meta, body = parse_yaml_front_matter(content, return_body=True)
    result = dict(meta)
    world = _extract_section(body, "世界观")
    if world:
        result["world"] = world
    characters = _extract_section(body, "角色")
    if characters:
        result["characters"] = characters
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
    """写入 context.md，支持三层记忆结构"""
    lines = [f"# 上下文摘要\n\n## 当前进度\n- 已完成：{context.get('current_chapter', 0)}章\n"]
    # 叙事意图
    if context.get("current_intent"):
        intent = context["current_intent"]
        lines.append("## 叙事意图")
        lines.append(f"- 角色想要：{intent.get('character_wants', '')}")
        lines.append(f"- 阻碍：{intent.get('obstacle', '')}")
        lines.append(f"- 读者关注：{intent.get('reader_should_care', '')}\n")
    # 角色状态（结构化）
    char_states = context.get("character_states", [])
    if char_states and isinstance(char_states, list) and char_states and isinstance(char_states[0], dict):
        lines.append("## 角色状态")
        for s in char_states:
            lines.append(f"- {s.get('name', '?')}：{s.get('location', '?')}，{s.get('power_level', '?')}，{s.get('recent_action', '?')}")
        lines.append("")
    elif context.get("character_states"):
        lines.append("## 角色状态\n" + "\n".join(f"- {s}" for s in context["character_states"]) + "\n")
    # 关键事件
    if context.get("plot_events"):
        lines.append("## 关键事件")
        for e in context["plot_events"][-10:]:
            lines.append(f"- {e}")
        lines.append("")
    # 未解决悬念
    if context.get("unresolved_threads"):
        lines.append("## 未解决悬念")
        for t in context["unresolved_threads"][-10:]:
            lines.append(f"- [ ] {t}")
        lines.append("")
    # 张力清单
    if context.get("tension_checklist"):
        lines.append("## 张力清单")
        for t in context["tension_checklist"][-10:]:
            mark = "x" if t.get("status") == "resolved" else " "
            lines.append(f"- [{mark}] {t.get('item', '')}")
        lines.append("")
    # 情感弧线
    if context.get("emotional_arc"):
        lines.append("## 情感弧线")
        for e in context["emotional_arc"][-8:]:
            lines.append(f"- {e.get('tag', '?')}({e.get('intensity', '?')})")
        lines.append("")
    # 向后兼容：旧格式摘要
    if context.get("recent_summaries"):
        lines.append("## 剧情摘要（最近5章）\n" + "\n".join(context["recent_summaries"][-5:]) + "\n")
    write_file(CONTEXT_FILE, "\n".join(lines))


def read_context() -> str:
    """读取 context.md 作为文本"""
    return read_file(CONTEXT_FILE)


def read_context_dict() -> dict:
    """读取 context.md 解析为字典，支持三层记忆结构"""
    content = read_file(CONTEXT_FILE)
    result: dict = {
        "current_chapter": 0,
        "recent_summaries": [],
        "character_states": [],
        "pending_plots": [],
        "plot_events": [],
        "unresolved_threads": [],
        "emotional_arc": [],
        "tension_checklist": [],
        "current_intent": None,
    }
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
        elif line.startswith("## 叙事意图"):
            current_section = "intent"
        elif line.startswith("## 关键事件"):
            current_section = "events"
        elif line.startswith("## 未解决悬念"):
            current_section = "threads"
        elif line.startswith("## 张力清单"):
            current_section = "tension"
        elif line.startswith("## 情感弧线"):
            current_section = "emotion"
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
        elif current_section == "intent" and line.startswith("- "):
            if result["current_intent"] is None:
                result["current_intent"] = {}
            text = line[2:]
            if text.startswith("角色想要："):
                result["current_intent"]["character_wants"] = text[5:]
            elif text.startswith("阻碍："):
                result["current_intent"]["obstacle"] = text[3:]
            elif text.startswith("读者关注："):
                result["current_intent"]["reader_should_care"] = text[5:]
        elif current_section == "events" and line.startswith("- "):
            result["plot_events"].append(line[2:])
        elif current_section == "threads" and line.startswith("- [ ] "):
            result["unresolved_threads"].append(line[6:])
        elif current_section == "tension" and line.startswith("- ["):
            mark = line[3]
            item = line[6:]
            result["tension_checklist"].append({
                "item": item,
                "status": "resolved" if mark == "x" else "open",
            })
        elif current_section == "emotion" and line.startswith("- "):
            text = line[2:]
            m = re.match(r"(.+)\((\d+)\)", text)
            if m:
                result["emotional_arc"].append({"tag": m.group(1), "intensity": int(m.group(2))})
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
