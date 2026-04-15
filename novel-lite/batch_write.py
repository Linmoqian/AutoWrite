#!/usr/bin/env python3
"""批量写作脚本 - 后台持续创作"""

import sys
import time
from pathlib import Path
from core import Novel
from files import read_context_dict

def main():
    novel = Novel(Path(__file__).parent)
    target = 100
    max_retries = 3
    fail_count = 0
    skipped = []

    while True:
        ctx = read_context_dict()
        current = ctx.get("current_chapter", 0)

        if current >= target:
            print(f"✓ 已完成 {current} 章，达到目标 {target} 章")
            break

        next_chapter = current + 1
        print(f"\n{'='*50}")
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 开始创作第 {next_chapter} 章...")
        print(f"{'='*50}")

        try:
            novel.write_chapter()
            fail_count = 0
            print(f"✓ 第 {next_chapter} 章完成 ({current+1}/{target})")
        except Exception as e:
            fail_count += 1
            print(f"✗ 第 {next_chapter} 章失败({fail_count}/{max_retries}): {e}")
            if fail_count >= max_retries:
                print(f"⚠ 第 {next_chapter} 章连续失败 {max_retries} 次，跳过")
                skipped.append(next_chapter)
                fail_count = 0
            else:
                print("等待 60 秒后重试...")
                time.sleep(60)
                continue

    print("\n✓ 全部创作完成！")
    if skipped:
        print(f"⚠ 跳过的章节: {skipped}")

if __name__ == "__main__":
    main()
