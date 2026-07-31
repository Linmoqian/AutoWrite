// 原子写入，照搬 src-tauri/src/files.rs:135-144。
// 流程：若文件已存在，先复制为 .bak；写入 .tmp；rename 覆盖目标。
import * as fs from "node:fs";
import * as path from "node:path";

import { AppError } from "../error.js";

export function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

// 读取文件，不存在返回空串；CRLF 归一化为 LF。照搬 files.rs:127-133
export function readFile(pathStr: string): string {
  if (!fs.existsSync(pathStr)) return "";
  let content: string;
  try {
    content = fs.readFileSync(pathStr, "utf8");
  } catch (e) {
    throw AppError.io(e);
  }
  return normalizeNewlines(content);
}

// 原子写入：先备份 .bak，再写 .tmp，最后 rename。照搬 files.rs:135-144
export function writeFileAtomic(pathStr: string, content: string): void {
  try {
    if (fs.existsSync(pathStr)) {
      const bak = `${pathStr}.bak`;
      try {
        fs.copyFileSync(pathStr, bak);
      } catch {
        // Rust: let _ = 忽略备份失败
      }
    }
    const tmp = `${pathStr}.tmp`;
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, pathStr);
  } catch (e) {
    throw AppError.io(e);
  }
}

// 路径辅助，照搬 files.rs:108-119
export function novelFile(dir: string): string {
  return path.join(dir, "novel.md");
}
export function outlineFile(dir: string): string {
  return path.join(dir, "outline.md");
}
export function contextFile(dir: string): string {
  return path.join(dir, "context.md");
}
export function chaptersDir(dir: string): string {
  return path.join(dir, "chapters");
}
