// get_status，照搬 src-tauri/src/novel.rs:534-549。
// 返回 novel + context + outline + 章节统计。

import { listChapters, readContext, readNovel, readOutline } from "../files/index.js";
import type { ContextData, NovelData, Volume } from "../files/index.js";

// NovelStatus：Rust 无 rename_all，字段保持 snake_case
export interface NovelStatus {
  novel: NovelData;
  context: ContextData;
  outline: Volume[];
  total_chapters: number;
  written_chapters: number;
}

export function getStatus(dir: string): NovelStatus {
  const novel = readNovel(dir);
  const context = readContext(dir);
  const outline = readOutline(dir);
  const chapters = listChapters(dir);
  const totalChapters = outline.reduce((sum, v) => sum + v.chapters.length, 0);
  const writtenChapters = chapters.length;

  return {
    novel,
    context,
    outline,
    total_chapters: totalChapters,
    written_chapters: writtenChapters,
  };
}
