"""极简本地小说创作系统"""

import os
import time
import shutil
import yaml
import argparse
from datetime import datetime
from pathlib import Path
from typing import Tuple

import ollama

# 配置
MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:7b")
TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "300"))

# 文件路径
NOVEL_FILE = Path("novel.md")
OUTLINE_FILE = Path("outline.md")
CONTEXT_FILE = Path("context.md")
CHAPTERS_DIR = Path("chapters")

# 提示词模板
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
            time.sleep(2 ** attempt)


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


def parse_yaml_front_matter(content: str, return_body: bool = False) -> dict | Tuple[dict, str]:
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


def gen_world() -> str:
    """生成世界观"""
    novel = read_novel()
    world = generate(WORLD_PROMPT.format(genre=novel.get("genre", "玄幻"), theme=novel.get("theme", "修仙")))
    novel["world"] = world
    write_novel(novel)
    return world


def gen_character() -> str:
    """生成角色"""
    novel = read_novel()
    characters = generate(CHARACTER_PROMPT.format(world=novel.get("world", "")))
    novel["characters"] = characters
    write_novel(novel)
    return characters


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


def gen_outline() -> str:
    """生成大纲"""
    novel = read_novel()
    outline_text = generate(OUTLINE_PROMPT.format(
        world=novel.get("world", ""), characters=novel.get("characters", ""),
        total_chapters=novel.get("target_chapters", 100)
    ))
    write_outline(parse_outline_text(outline_text))
    return outline_text


def gen_chapter(chapter_num: int) -> str:
    """生成章节"""
    novel = read_novel()
    chapter_title = get_chapter_outline(chapter_num)
    if not chapter_title:
        raise ValueError(f"未找到第 {chapter_num} 章的大纲")
    content = generate(CHAPTER_PROMPT.format(
        context=read_context(), num=chapter_num, title=chapter_title,
        outline_detail=f"第{chapter_num}章：{chapter_title}",
        words=novel.get("words_per_chapter", 3000),
        style=f"{novel.get('genre', '玄幻')}类型，{novel.get('theme', '')}主题"
    ))
    # 写入章节文件
    CHAPTERS_DIR.mkdir(exist_ok=True)
    meta = {"chapter": chapter_num, "title": chapter_title, "words": len(content),
            "created": datetime.now().strftime("%Y-%m-%d")}
    write_file(CHAPTERS_DIR / f"{chapter_num:03d}-{chapter_title[:10]}.md",
               build_yaml_front_matter(meta) + f"\n# 第{chapter_num}章 {chapter_title}\n\n{content}")
    # 更新上下文
    context = read_context_dict()
    try:
        summary = generate(f"请用200字概括以下章节的剧情：\n{content[:2000]}")
    except Exception:
        summary = content[:200]
    context["recent_summaries"] = (context.get("recent_summaries", []) + [f"第{chapter_num}章：{summary}"])[-5:]
    context["current_chapter"] = chapter_num
    write_context(context)
    return content


# CLI 命令
def cmd_new(args):
    data = {
        "title": args.title, "genre": args.genre or "xuanhuan", "theme": args.theme or "修仙",
        "target_chapters": args.chapters or 100, "words_per_chapter": 3000, "model": MODEL,
        "created": datetime.now().strftime("%Y-%m-%d")
    }
    write_novel(data)
    write_context({"current_chapter": 0, "recent_summaries": []})
    print(f"✓ 创建小说: {args.title}")


def cmd_world(args):
    print("正在生成世界观...")
    print(f"✓ 世界观生成完成 ({len(gen_world())}字)")


def cmd_character(args):
    print("正在生成角色...")
    print(f"✓ 角色生成完成 ({len(gen_character())}字)")


def cmd_outline(args):
    print("正在生成大纲...")
    gen_outline()
    print("✓ 大纲生成完成")


def cmd_chapter(args):
    print(f"正在生成第 {args.num} 章...")
    print(f"✓ 第 {args.num} 章生成完成 ({len(gen_chapter(args.num))}字)")


def cmd_next(args):
    next_num = read_context_dict().get("current_chapter", 0) + 1
    print(f"正在生成第 {next_num} 章...")
    print(f"✓ 第 {next_num} 章生成完成 ({len(gen_chapter(next_num))}字)")


def cmd_status(args):
    novel = read_novel()
    if not novel:
        print("未找到小说，请先运行: python write.py new")
        return
    ctx = read_context_dict()
    print(f"📖 {novel.get('title', '未命名')}")
    print(f"   类型: {novel.get('genre', '-')} | 主题: {novel.get('theme', '-')}")
    print(f"   进度: {ctx.get('current_chapter', 0)} / {novel.get('target_chapters', '?')} 章")


def cmd_run(args):
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


def main():
    parser = argparse.ArgumentParser(description="极简本地小说创作系统")
    subparsers = parser.add_subparsers(dest="command", help="命令")
    p_new = subparsers.add_parser("new", help="创建新小说")
    p_new.add_argument("title", help="小说标题")
    p_new.add_argument("--genre", "-g", help="类型")
    p_new.add_argument("--theme", "-t", help="主题")
    p_new.add_argument("--chapters", "-c", type=int, help="目标章节数")
    p_new.set_defaults(func=cmd_new)
    subparsers.add_parser("world", help="生成世界观").set_defaults(func=cmd_world)
    subparsers.add_parser("character", help="生成角色").set_defaults(func=cmd_character)
    subparsers.add_parser("outline", help="生成大纲").set_defaults(func=cmd_outline)
    p_chapter = subparsers.add_parser("chapter", help="生成指定章节")
    p_chapter.add_argument("num", type=int, help="章节号")
    p_chapter.set_defaults(func=cmd_chapter)
    subparsers.add_parser("next", help="生成下一章").set_defaults(func=cmd_next)
    subparsers.add_parser("status", help="查看状态").set_defaults(func=cmd_status)
    subparsers.add_parser("run", help="一键全流程").set_defaults(func=cmd_run)
    args = parser.parse_args()
    if args.command:
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
