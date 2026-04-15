#!/usr/bin/env python3
"""章节润色脚本 - 使用 AI 润色已生成的章节"""

import argparse
import sys

# 强制刷新输出
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)
import re
import sys
import time
from pathlib import Path

from ai import generate
from config import CONFIG
from files import read_file, write_file, CHAPTERS_DIR, parse_yaml_front_matter, build_yaml_front_matter


POLISHED_DIR = Path("polished")


def get_polish_prompt(content: str, style: str = "玄幻修仙") -> str:
    """生成润色 prompt"""
    return CONFIG["prompts"]["polish"].format(
        style=style,
        content=content
    )


def extract_chapter_body(content: str) -> str:
    """提取章节正文（去除 YAML front matter）"""
    if content.startswith("---\n"):
        parts = content.split("---\n", 2)
        if len(parts) >= 3:
            return parts[2].strip()
    return content


def get_chapter_info(content: str) -> dict:
    """提取章节信息"""
    meta = parse_yaml_front_matter(content)
    return {
        "chapter": meta.get("chapter", 0),
        "title": meta.get("title", "未知标题"),
        "words": meta.get("words", 0),
    }


def find_chapter_file(chapter_num: int) -> Path | None:
    """查找章节文件"""
    pattern = f"{chapter_num:03d}-*.md"
    matches = list(CHAPTERS_DIR.glob(pattern))
    return matches[0] if matches else None


def polish_chapter(chapter_num: int, style: str = "玄幻修仙", output_dir: Path = None) -> bool:
    """润色单个章节"""
    # 查找原文件
    source_file = find_chapter_file(chapter_num)
    if not source_file:
        print(f"\033[31m✗ 未找到章节 {chapter_num}\033[0m")
        return False

    content = read_file(source_file)
    if not content:
        print(f"\033[31m✗ 章节 {chapter_num} 内容为空\033[0m")
        return False

    # 提取正文和信息
    body = extract_chapter_body(content)
    chapter_info = get_chapter_info(content)
    title = chapter_info.get("title", "未知标题")

    # 润色
    print(f"\033[36m正在润色第 {chapter_num} 章: {title}...\033[0m")
    prompt = get_polish_prompt(body, style)

    try:
        polished_content = generate(prompt)
    except Exception as e:
        print(f"\033[31m✗ 润色失败: {e}\033[0m")
        return False

    # 构建元数据
    meta = {
        "chapter": chapter_num,
        "title": title,
        "words": len(polished_content),
        "polished": True,
        "polish_time": time.strftime("%Y-%m-%d %H:%M"),
    }

    # 保存到润色目录
    if output_dir is None:
        output_dir = POLISHED_DIR
    output_dir.mkdir(exist_ok=True)

    output_file = output_dir / f"{chapter_num:03d}-{title[:10]}.md"
    full_content = build_yaml_front_matter(meta) + f"\n\n# 第{chapter_num}章 {title}\n\n{polished_content}\n"
    write_file(output_file, full_content)

    print(f"\033[32m✓ 第 {chapter_num} 章润色完成: {output_file}\033[0m")
    return True


def get_chapter_numbers() -> list[int]:
    """获取所有章节编号"""
    chapters = []
    for f in CHAPTERS_DIR.glob("*.md"):
        match = re.match(r"(\d+)", f.stem)
        if match:
            num = int(match.group(1))
            chapters.append(num)
    return sorted(chapters)


def batch_polish(style: str = "玄幻修仙", start: int = None, end: int = None, output_dir: Path = None) -> None:
    """批量润色章节"""
    chapters = get_chapter_numbers()

    # 过滤范围
    if start is not None:
        chapters = [c for c in chapters if c >= start]
    if end is not None:
        chapters = [c for c in chapters if c <= end]

    if not chapters:
        print("\033[33m没有找到符合条件的章节\033[0m")
        return

    total = len(chapters)
    completed = 0
    failed = 0
    skipped = 0

    if output_dir is None:
        output_dir = POLISHED_DIR

    print(f"\n\033[36m开始批量润色 {total} 章...\033[0m")

    for i, chapter_num in enumerate(chapters):
        # 检查是否已润色
        existing = list(output_dir.glob(f"{chapter_num:03d}-*.md"))
        if existing:
            print(f"\033[90m跳过章节 {chapter_num}: 已润色\033[0m")
            skipped += 1
            continue

        # 润色
        success = polish_chapter(chapter_num, style=style, output_dir=output_dir)
        if success:
            completed += 1
        else:
            failed += 1

        # 更新进度
        progress = (i + 1) / total * 100
        print(f"\033[90m[总进度: {i + 1}/{total} ({progress:.1f}%)]\033[0m")

    # 汇总统计
    print(f"\n\033[36m=== 润色统计 ===\033[0m")
    print(f"  总章节数: {total}")
    print(f"  润色成功: \033[32m{completed}\033[0m")
    print(f"  润色失败: \033[31m{failed}\033[0m")
    print(f"  已跳过: \033[33m{skipped}\033[0m")
    if completed + failed > 0:
        print(f"  成功率: {completed / (completed + failed) * 100:.1f}%")


def main():
    parser = argparse.ArgumentParser(
        description="章节润色工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python polish.py single 1           # 润色第 1 章
  python polish.py all                # 润色所有章节
  python polish.py batch --start 1 --end 10  # 润色 1-10 章
  python polish.py batch --start 50   # 润色 50 章及之后
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # single 命令
    single_parser = subparsers.add_parser("single", help="润色单个章节")
    single_parser.add_argument("chapter", type=int, help="章节号 (1-100)")
    single_parser.add_argument("--style", "-s", default="玄幻修仙", help="润色风格")
    single_parser.add_argument("--output", "-o", default="polished", help="输出目录")

    # all 命令
    all_parser = subparsers.add_parser("all", help="润色所有章节")
    all_parser.add_argument("--style", "-s", default="玄幻修仙", help="润色风格")
    all_parser.add_argument("--output", "-o", default="polished", help="输出目录")

    # batch 命令
    batch_parser = subparsers.add_parser("batch", help="批量润色章节")
    batch_parser.add_argument("--start", type=int, default=None, help="起始章节")
    batch_parser.add_argument("--end", type=int, default=None, help="结束章节")
    batch_parser.add_argument("--style", "-s", default="玄幻修仙", help="润色风格")
    batch_parser.add_argument("--output", "-o", default="polished", help="输出目录")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    output_dir = Path(args.output) if hasattr(args, 'output') else POLISHED_DIR

    if args.command == "single":
        if args.chapter < 1 or args.chapter > 100:
            print("\033[31m章节号必须在 1-100 之间\033[0m")
            sys.exit(1)
        success = polish_chapter(args.chapter, args.style, output_dir)
        sys.exit(0 if success else 1)

    elif args.command == "all":
        batch_polish(style=args.style, output_dir=output_dir)

    elif args.command == "batch":
        if args.start is None and args.end is None:
            print("\033[33m请指定 --start 或 --end 参数\033[0m")
            sys.exit(1)
        batch_polish(style=args.style, start=args.start, end=args.end, output_dir=output_dir)


if __name__ == "__main__":
    main()
