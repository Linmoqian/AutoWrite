// outline.md 读写，照搬 src-tauri/src/files.rs:227-312。
// 格式：# 大纲 / ## 卷名 / - NNN. 标题；章节号补零到 3 位。

import { outlineFile, readFile, writeFileAtomic } from "./atomic.js";
import type { Volume } from "./types.js";

// 写 outline.md，照搬 files.rs:227-237
export function writeOutline(dir: string, outline: Volume[]): void {
  const lines: string[] = ["# 大纲\n"];
  for (const volume of outline) {
    lines.push(`## ${volume.volume}\n`);
    for (const ch of volume.chapters) {
      lines.push(`- ${pad3(ch.num)}. ${ch.title}`);
    }
    lines.push("");
  }
  writeFileAtomic(outlineFile(dir), lines.join("\n"));
}

// Rust format!("{:03}", num)：补零到 3 位
function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

export function readOutline(dir: string): Volume[] {
  const content = readFile(outlineFile(dir));
  if (content === "") return [];
  return parseOutlineText(content);
}

export function getChapterOutline(
  dir: string,
  chapterNum: number,
): string | undefined {
  const outline = readOutline(dir);
  for (const volume of outline) {
    for (const ch of volume.chapters) {
      if (ch.num === chapterNum) return ch.title;
    }
  }
  return undefined;
}

// 解析大纲文本，照搬 files.rs:259-312。三种行格式：## 卷、- N. 标题、裸 N. 标题。
export function parseOutlineText(text: string): Volume[] {
  const outline: Volume[] = [];
  let currentVolume: Volume | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      if (currentVolume) outline.push(currentVolume);
      currentVolume = { volume: line.slice(3), chapters: [] };
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (currentVolume) {
        const rest = line.slice(2);
        const dotPos = rest.indexOf(". ");
        if (dotPos >= 0) {
          const num = parseInt(rest.slice(0, dotPos).trim(), 10);
          if (!Number.isNaN(num)) {
            currentVolume.chapters.push({
              num,
              title: rest.slice(dotPos + 2).trim(),
            });
          }
        }
      }
    } else {
      // 裸格式：数字. 标题（行首为 ASCII 数字）
      if (currentVolume) {
        const firstChar = line.charAt(0);
        if (firstChar >= "0" && firstChar <= "9") {
          // 跳过前导数字
          const restAfterDigits = line.replace(/^[0-9]+/, "");
          if (restAfterDigits.startsWith(".")) {
            const title = restAfterDigits.slice(1).trimStart();
            if (title !== "") {
              const numEnd = line.search(/[^0-9]/);
              const numStartIdx = numEnd === -1 ? 0 : numEnd;
              const num = parseInt(line.slice(0, numStartIdx), 10);
              if (!Number.isNaN(num)) {
                currentVolume.chapters.push({ num, title });
              }
            }
          }
        }
      }
    }
  }
  if (currentVolume) outline.push(currentVolume);
  return outline;
}
