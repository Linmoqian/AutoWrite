// 导出模块，照搬 src-tauri/src/export.rs。
// 仅实现 md/txt（DOCX/PDF 由前端生成）。collect_export_data + render_markdown + render_plain_text。

import { listChaptersWithContent, readNovel, readOutline } from "./files/index.js";
import type { NovelData, Volume } from "./files/index.js";

// ExportData：Rust 用 #[serde(rename_all="camelCase")]，但 novel 是 NovelData（snake_case）
// 嵌套结构字段大小写混合；这里类型如实反映
export interface ExportChapter {
  num: number;
  title: string;
  words: number;
  body: string;
}

export interface ExportData {
  novel: NovelData;
  outline: Volume[];
  chapters: ExportChapter[];
}

// collect_export_data，照搬 export.rs:23-43
export function collectExportData(dir: string): ExportData {
  const novel = readNovel(dir);
  const outline = readOutline(dir);
  const rawChapters = listChaptersWithContent(dir);
  const chapters: ExportChapter[] = rawChapters.map(({ meta, body }) => ({
    num: meta.chapter,
    title: meta.title,
    words: meta.words,
    body,
  }));
  return { novel, outline, chapters };
}

// render_markdown，照搬 export.rs:45-91
export function renderMarkdown(data: ExportData): string {
  const parts: string[] = [];

  // 标题页
  parts.push(`# ${data.novel.title}\n`);
  parts.push(`> ${data.novel.genre} | ${data.novel.theme} | ${data.novel.target_chapters}章\n`);
  parts.push(`> 创建日期：${data.novel.created}\n`);

  if (data.novel.world) {
    parts.push("");
    parts.push("## 世界观\n");
    parts.push(data.novel.world);
  }

  if (data.novel.characters) {
    parts.push("");
    parts.push("## 角色\n");
    parts.push(data.novel.characters);
  }

  // 目录
  if (data.outline.length > 0) {
    parts.push("");
    parts.push("---\n");
    parts.push("## 目录\n");
    for (const volume of data.outline) {
      parts.push(`### ${volume.volume}\n`);
      for (const ch of volume.chapters) {
        parts.push(`- ${String(ch.num).padStart(3, "0")}. ${ch.title}`);
      }
      parts.push("");
    }
  }

  // 章节正文
  for (const chapter of data.chapters) {
    parts.push("");
    parts.push("---\n");
    parts.push(`# 第${chapter.num}章 ${chapter.title}\n`);
    parts.push(chapter.body);
  }

  return parts.join("\n");
}

// render_plain_text，照搬 export.rs:93-96
export function renderPlainText(data: ExportData): string {
  const md = renderMarkdown(data);
  return stripMarkdown(md);
}

// strip_markdown，照搬 export.rs:98-127
function stripMarkdown(text: string): string {
  let result = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    let processed: string;
    if (trimmed === "---") {
      processed = "";
    } else if (trimmed.startsWith("# ")) {
      processed = `\n${stripFormatting(trimmed.slice(2))}\n`;
    } else if (trimmed.startsWith("## ")) {
      processed = `\n${stripFormatting(trimmed.slice(3))}\n`;
    } else if (trimmed.startsWith("### ")) {
      processed = `\n${stripFormatting(trimmed.slice(4))}\n`;
    } else if (trimmed.startsWith("> ")) {
      processed = `  ${stripFormatting(trimmed.slice(2))}`;
    } else if (trimmed.startsWith("- ")) {
      processed = `  · ${stripFormatting(trimmed.slice(2))}`;
    } else if (trimmed.startsWith("* ")) {
      processed = `  · ${stripFormatting(trimmed.slice(2))}`;
    } else {
      processed = stripFormatting(trimmed);
    }
    result += processed;
    result += "\n";
  }
  // 压缩 3+ 连续换行为 2 个
  while (result.includes("\n\n\n")) {
    result = result.replace(/\n\n\n/g, "\n\n");
  }
  return result.trim() + "\n";
}

// strip_formatting，照搬 export.rs:129-138
function stripFormatting(text: string): string {
  return stripSimpleCode(stripSimpleItalic(stripSimpleBold(text)));
}

// regex_simple_bold，照搬 export.rs:140-170
// 去除 **text** 的 ** 标记
function stripSimpleBold(text: string): string {
  const chars = [...text];
  let result = "";
  let i = 0;
  while (i < chars.length) {
    if (i + 1 < chars.length && chars[i] === "*" && chars[i + 1] === "*") {
      const start = i + 2;
      let end = start;
      while (end + 1 < chars.length) {
        if (chars[end] === "*" && chars[end + 1] === "*") break;
        end++;
      }
      if (end + 1 < chars.length) {
        result += chars.slice(start, end).join("");
        i = end + 2;
      } else {
        result += chars[i];
        i++;
      }
    } else {
      result += chars[i];
      i++;
    }
  }
  return result;
}

// regex_simple_italic，照搬 export.rs:172-201
// 去除 *text* 的 * 标记（不处理 **）
function stripSimpleItalic(text: string): string {
  const chars = [...text];
  let result = "";
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === "*" && (i === 0 || chars[i - 1] !== "*")) {
      const start = i + 1;
      let end = start;
      while (end < chars.length) {
        if (chars[end] === "*" && (end + 1 >= chars.length || chars[end + 1] !== "*")) {
          break;
        }
        end++;
      }
      if (end < chars.length) {
        result += chars.slice(start, end).join("");
        i = end + 1;
      } else {
        result += chars[i];
        i++;
      }
    } else {
      result += chars[i];
      i++;
    }
  }
  return result;
}

// regex_simple_code，照搬 export.rs:203-229
// 去除 `text` 的 ` 标记
function stripSimpleCode(text: string): string {
  const chars = [...text];
  let result = "";
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === "`") {
      const start = i + 1;
      let end = start;
      while (end < chars.length && chars[end] !== "`") {
        end++;
      }
      if (end < chars.length) {
        result += chars.slice(start, end).join("");
        i = end + 1;
      } else {
        result += chars[i];
        i++;
      }
    } else {
      result += chars[i];
      i++;
    }
  }
  return result;
}

// total_words，照搬 export.rs:231-233
export function totalWords(data: ExportData): number {
  return data.chapters.reduce((sum, c) => sum + c.words, 0);
}
