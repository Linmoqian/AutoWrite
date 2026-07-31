// 章节生成逻辑，照搬 src-tauri/src/novel.rs:213-532。
// 含：build_chapter_prompt（纯函数）、三层记忆提取、merge_facts、update_tension。

import * as fs from "node:fs";
import * as path from "node:path";

import { generate, generateStreaming } from "../ai/index.js";
import type { AppConfig } from "../config.js";
import { fillTemplate } from "../config.js";
import { AppError } from "../error.js";
import { chaptersDir, writeFileAtomic } from "../files/atomic.js";
import {
  getChapterOutline,
  readContext,
  readNovel,
  writeContext,
} from "../files/index.js";
import type {
  CharacterStateRaw,
  ChapterMeta,
  ContextData,
  NarrativeIntent,
  NovelData,
} from "../files/index.js";
import { emitChapterProgress } from "../lib/sse.js";
import { yamlDump } from "../lib/yaml-schema.js";

// generate_chapter_streaming，照搬 novel.rs:213-282
export async function generateChapterStreaming(
  dir: string,
  config: AppConfig,
): Promise<number> {
  const ctx = readContext(dir);
  const chapterNum = ctx.current_chapter + 1;

  const novel = readNovel(dir);
  const chapterTitle = getChapterOutline(dir, chapterNum);
  if (chapterTitle === undefined) {
    throw AppError.outlineMissing(chapterNum);
  }

  const prompt = buildChapterPrompt(ctx, chapterNum, chapterTitle, novel, config);

  // 流式生成章节内容
  const content = await generateStreaming(config, prompt, (chunk) => {
    emitChapterProgress({ chunk, done: false });
  });

  // 写入章节文件（含 .bak 原子写入）
  writeChapterFile(dir, chapterNum, chapterTitle, content);

  // 通知前端进入后处理阶段
  emitChapterProgress({ chunk: "\n\n[正在提取叙事记忆...]", done: false });

  // 三次提取 + 更新三层记忆
  await updateMemory(dir, config, chapterNum, content);

  // 生成完成
  emitChapterProgress({ chunk: "", done: true });

  return chapterNum;
}

// 章节文件写入逻辑，照搬 novel.rs:242-258
// 文件名 NNN-标题前10字符.md；words 为字节数（quirk）；front matter + # 第N章 标题
function writeChapterFile(
  dir: string,
  chapterNum: number,
  chapterTitle: string,
  content: string,
): void {
  const chDir = chaptersDir(dir);
  fs.mkdirSync(chDir, { recursive: true });

  // 标题取前 10 个字符（JS 按字符，与 Rust chars().take(10) 一致）
  const safeTitle = [...chapterTitle].slice(0, 10).join("");
  const filename = `${String(chapterNum).padStart(3, "0")}-${safeTitle}.md`;

  // words 为字节长度（照搬 novel.rs:250 的 quirk）
  const meta: ChapterMeta = {
    chapter: chapterNum,
    title: chapterTitle,
    words: Buffer.byteLength(content, "utf8"),
    created: today(),
  };
  const metaYaml = yamlDump(meta);
  const fileContent = `---\n${metaYaml}---\n\n# 第${chapterNum}章 ${chapterTitle}\n\n${content}`;
  writeFileAtomic(path.join(chDir, filename), fileContent);
}

function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// build_chapter_prompt，照搬 novel.rs:284-382（纯函数）
export function buildChapterPrompt(
  ctx: ContextData,
  num: number,
  title: string,
  novel: NovelData,
  config: AppConfig,
): string {
  const genre = novel.genre;
  const theme = novel.theme;
  const words = String(novel.words_per_chapter);

  // 叙事意图块
  const intentBlock = ctx.current_intent
    ? `当前核心张力：${ctx.current_intent.obstacle}\n读者关注点：${ctx.current_intent.reader_should_care}`
    : "当前核心张力：主角在故事中面临新的挑战\n读者关注点：主角如何应对";

  // 角色状态（反序取前 10）
  const cs =
    ctx.character_states.length === 0
      ? "- 暂无角色状态"
      : reverseTake(ctx.character_states, 10)
          .map((s) => formatCharacterStateForPrompt(s))
          .join("\n");

  // 关键事件（反序取前 8）
  const pe =
    ctx.plot_events.length === 0
      ? "- 暂无"
      : reverseTake(ctx.plot_events, 8)
          .map((e) => `- ${e}`)
          .join("\n");

  // 张力清单（tension 反序取前 8 + unresolved_threads 反序取前 8）
  const tc =
    ctx.tension_checklist.length === 0 && ctx.unresolved_threads.length === 0
      ? "- 暂无"
      : [
          ...reverseTake(ctx.tension_checklist, 8).map(
            (t) => `- [${t.status === "resolved" ? "x" : " "}] ${t.item}`,
          ),
          ...reverseTake(ctx.unresolved_threads, 8).map((t) => `- [ ] ${t}`),
        ].join("\n");

  // 情感弧线（反序取前 6，用 → 连接）
  const ea =
    ctx.emotional_arc.length === 0
      ? "暂无"
      : reverseTake(ctx.emotional_arc, 6)
          .map((e) => `${e.tag}(${e.intensity})`)
          .join(" → ");

  return fillTemplate(config.prompts.chapter, {
    genre,
    theme,
    intent_block: intentBlock,
    character_states: cs,
    plot_events: pe,
    tension_checklist: tc,
    emotional_arc: ea,
    num: String(num),
    title,
    words,
  });
}

// 角色状态格式化：照搬 novel.rs:312-320
// 对象时取 name/location/power_level/status；非对象时输出 Debug 格式
function formatCharacterStateForPrompt(s: CharacterStateRaw): string {
  if (typeof s === "string") {
    // Rust 的 format!("- {:?}", s) 对字符串是 "- \"...\""
    return `- ${JSON.stringify(s)}`;
  }
  const name = strField(s, "name");
  if (name) {
    const loc = strField(s, "location") ?? "?";
    const pw = strField(s, "power_level") ?? "?";
    const st = strField(s, "status") ?? "正常";
    return `- ${name}：${loc}，${pw}，${st}`;
  }
  // Rust 的 format!("- {:?}", s)：对象时近似 JSON
  return `- ${JSON.stringify(s)}`;
}

function strField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

// update_memory，照搬 novel.rs:384-416
async function updateMemory(
  dir: string,
  config: AppConfig,
  chapterNum: number,
  content: string,
): Promise<void> {
  const ctx = readContext(dir);
  // Rust: &content[..content.len().min(3000)] 按字节截断
  // 注意：Rust 在 3000 落在 UTF-8 字符中间时会 panic；此处截到合法字符边界（安全等价）
  const truncated = truncateUtf8(content, 3000);

  // 提取结构化事实（失败则跳过，照搬 if let Ok）
  try {
    const facts = await extractFacts(config, truncated);
    mergeFacts(ctx, facts);
  } catch {
    // 跳过
  }

  // 提取叙事意图
  try {
    const intent = await extractIntent(config, truncated);
    ctx.current_intent = intent;
  } catch {
    // 跳过
  }

  // 提取情感弧线
  try {
    const tags = await extractEmotion(config, truncated);
    ctx.emotional_arc.push(...tags);
    // 保留最后 15 个（照搬 saturating_sub + split_off）
    const keep = Math.max(0, ctx.emotional_arc.length - 15);
    ctx.emotional_arc = ctx.emotional_arc.slice(keep);
  } catch {
    // 跳过
  }

  // 更新张力清单
  updateTension(ctx);

  ctx.current_chapter = chapterNum;
  writeContext(dir, ctx);
}

// 按字节截断到合法 UTF-8 边界。对应 Rust 的 &content[..n]，但避免切断多字节字符。
function truncateUtf8(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= maxBytes) return s;
  let len = maxBytes;
  // UTF-8 续字节以 10xxxxxx 开头，向前回退到字符首字节
  while (len > 0 && (buf[len] & 0xc0) === 0x80) {
    len--;
  }
  return buf.subarray(0, len).toString("utf8");
}

// extract_facts，照搬 novel.rs:418-422。返回原始 JSON 对象
async function extractFacts(config: AppConfig, content: string): Promise<unknown> {
  const prompt = fillTemplate(config.prompts.extract_facts, { content });
  const raw = await generate(config, prompt);
  return parseJsonResponse(raw);
}

// extract_intent，照搬 novel.rs:424-436
async function extractIntent(
  config: AppConfig,
  content: string,
): Promise<NarrativeIntent> {
  const prompt = fillTemplate(config.prompts.extract_intent, { content });
  const raw = await generate(config, prompt);
  const json = (await parseJsonResponse(raw)) as Record<string, unknown>;
  return {
    character_wants: jsonStringField(json, "character_wants"),
    obstacle: jsonStringField(json, "obstacle"),
    reader_should_care: jsonStringField(json, "reader_should_care"),
  };
}

// extract_emotion，照搬 novel.rs:438-453
async function extractEmotion(
  config: AppConfig,
  content: string,
): Promise<{ tag: string; intensity: number }[]> {
  const prompt = fillTemplate(config.prompts.extract_emotion, { content });
  const raw = await generate(config, prompt);
  const json = (await parseJsonResponse(raw)) as { tags?: unknown };
  const tags = Array.isArray(json.tags) ? json.tags : [];
  const result: { tag: string; intensity: number }[] = [];
  for (const t of tags) {
    if (t && typeof t === "object") {
      const obj = t as Record<string, unknown>;
      const tag = typeof obj.tag === "string" ? obj.tag : "";
      const intensity = typeof obj.intensity === "number" ? obj.intensity : 1;
      if (tag !== "") {
        result.push({ tag, intensity });
      }
    }
  }
  return result;
}

// parse_json_response，照搬 novel.rs:455-469
// 先剥 ```json ... ``` 围栏，再取最外层 { ... } 切片
export function parseJsonResponse(text: string): unknown {
  const re = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const match = text.match(re);
  const candidate = (match ? match[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const jsonStr = end > start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonStr);
}

// merge_facts，照搬 novel.rs:471-518
export function mergeFacts(ctx: ContextData, facts: unknown): void {
  const f = (facts ?? {}) as Record<string, unknown>;

  // 合并角色状态
  if (Array.isArray(f.character_states)) {
    for (const ns of f.character_states) {
      const obj = (ns ?? {}) as Record<string, unknown>;
      const newName = typeof obj.name === "string" ? obj.name : "";
      if (newName === "") continue;
      const idx = ctx.character_states.findIndex((s) => {
        if (typeof s === "string") return false;
        return strField(s, "name") === newName;
      });
      if (idx >= 0) {
        ctx.character_states[idx] = obj;
      } else {
        ctx.character_states.push(obj);
      }
    }
    const keep = Math.max(0, ctx.character_states.length - 20);
    ctx.character_states = ctx.character_states.slice(keep);
  }

  // 合并关键事件
  if (Array.isArray(f.plot_events)) {
    for (const e of f.plot_events) {
      if (typeof e === "string") ctx.plot_events.push(e);
    }
    const keep = Math.max(0, ctx.plot_events.length - 20);
    ctx.plot_events = ctx.plot_events.slice(keep);
  }

  // 合并未解决悬念（去重）
  if (Array.isArray(f.unresolved_threads)) {
    for (const t of f.unresolved_threads) {
      if (typeof t === "string" && !ctx.unresolved_threads.includes(t)) {
        ctx.unresolved_threads.push(t);
      }
    }
    const keep = Math.max(0, ctx.unresolved_threads.length - 15);
    ctx.unresolved_threads = ctx.unresolved_threads.slice(keep);
  }
}

// update_tension，照搬 novel.rs:520-532
export function updateTension(ctx: ContextData): void {
  for (const t of ctx.unresolved_threads) {
    const exists = ctx.tension_checklist.some((tc) => tc.item === t);
    if (!exists) {
      ctx.tension_checklist.push({ item: t, status: "open" });
    }
  }
  const keep = Math.max(0, ctx.tension_checklist.length - 15);
  ctx.tension_checklist = ctx.tension_checklist.slice(keep);
}

function jsonStringField(obj: Record<string, unknown>, key: string): string {
  return typeof obj[key] === "string" ? (obj[key] as string) : "";
}

// 反序取前 n：对应 Rust iter().rev().take(n)
function reverseTake<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n)).reverse();
}
