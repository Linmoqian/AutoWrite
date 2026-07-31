// 章节文件操作，照搬 src-tauri/src/files.rs:458-510。
// chapters/NNN-标题.md，YAML front matter（ChapterMeta snake_case）+ 正文。

import * as fs from "node:fs";
import * as path from "node:path";

import { AppError } from "../error.js";
import { chaptersDir, readFile } from "./atomic.js";
import { parseYamlFrontMatter } from "./frontmatter.js";
import type { ChapterMeta } from "./types.js";

// 列举所有章节，按 chapter 排序。照搬 files.rs:458-479
export function listChapters(dir: string): ChapterMeta[] {
  const chDir = chaptersDir(dir);
  if (!fs.existsSync(chDir)) return [];

  const chapters: ChapterMeta[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(chDir);
  } catch (e) {
    throw AppError.io(e);
  }
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const full = path.join(chDir, name);
    const content = readFile(full);
    const [meta] = parseYamlFrontMatter(content);
    if (meta && typeof meta === "object") {
      const ch = metaToChapterMeta(meta);
      if (ch) chapters.push(ch);
    }
  }
  chapters.sort((a, b) => a.chapter - b.chapter);
  return chapters;
}

// 读单个章节，返回 [meta, body]。照搬 files.rs:481-487
export function readChapter(
  dir: string,
  filename: string,
): { meta: ChapterMeta; body: string } {
  const full = path.join(chaptersDir(dir), filename);
  const content = readFile(full);
  const [meta, body] = parseYamlFrontMatter(content);
  return { meta: metaToChapterMetaStrict(meta), body };
}

// 列举章节及正文（导出用），按 chapter 排序。照搬 files.rs:489-510
export function listChaptersWithContent(
  dir: string,
): { meta: ChapterMeta; body: string }[] {
  const chDir = chaptersDir(dir);
  if (!fs.existsSync(chDir)) return [];

  const chapters: { meta: ChapterMeta; body: string }[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(chDir);
  } catch (e) {
    throw AppError.io(e);
  }
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const full = path.join(chDir, name);
    const content = readFile(full);
    const [meta, body] = parseYamlFrontMatter(content);
    if (meta && typeof meta === "object") {
      const ch = metaToChapterMeta(meta);
      if (ch) chapters.push({ meta: ch, body });
    }
  }
  chapters.sort((a, b) => a.meta.chapter - b.meta.chapter);
  return chapters;
}

function metaToChapterMeta(meta: unknown): ChapterMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  if (
    typeof m.chapter !== "number" ||
    typeof m.title !== "string" ||
    typeof m.words !== "number" ||
    typeof m.created !== "string"
  ) {
    return null;
  }
  return {
    chapter: m.chapter,
    title: m.title,
    words: m.words,
    created: m.created,
  };
}

// read_chapter 用 serde_yaml::from_value，缺字段会抛错。这里复刻为抛 AppError。
function metaToChapterMetaStrict(meta: unknown): ChapterMeta {
  const ch = metaToChapterMeta(meta);
  if (!ch) {
    throw AppError.yaml("chapter front matter 缺失或字段不完整");
  }
  return ch;
}
