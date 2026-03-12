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
