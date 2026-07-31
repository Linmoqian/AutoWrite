// 大纲三步流水线，照搬 src-tauri/src/novel.rs:79-211。
// world → characters → outline 三步流式生成，每步推送 outline-progress 事件。
// start_outline_generation 的后台任务状态管理在 routes 层处理。

import * as fs from "node:fs";

import { generateStreaming } from "../ai/index.js";
import type { AppConfig } from "../config.js";
import { fillTemplate } from "../config.js";
import { AppError } from "../error.js";
import {
  defaultContextData,
  parseOutlineText,
  readNovel,
  writeContext,
  writeNovel,
  writeOutline,
} from "../files/index.js";
import type { NovelData } from "../files/index.js";
import { emitOutlineProgress } from "../lib/sse.js";

export type OutlineStep = "world" | "characters" | "outline";

export interface OutlineProgressHandler {
  (step: string, chunk: string, done: boolean): void;
}

// generate_outline_streaming_with_progress，照搬 novel.rs:87-169
// target_step 为空串时跑全部三步；否则只跑指定步骤，其余发 skip 事件。
export async function generateOutlineStreamingWithProgress(
  dir: string,
  config: AppConfig,
  targetStep: string,
  onProgress: OutlineProgressHandler,
): Promise<string> {
  const novel = readNovel(dir);

  const needWorld = targetStep === "" || targetStep === "world";
  const needCharacters = targetStep === "" || targetStep === "characters";
  const needOutline = targetStep === "" || targetStep === "outline";

  // Step 1: 生成世界观
  const world = needWorld
    ? await runStep(dir, config, "world", onProgress, () =>
        fillTemplate(config.prompts.world, {
          genre: novel.genre,
          theme: novel.theme,
        }),
      )
    : (emitSkip("world", onProgress), novel.world ?? "");

  // Step 2: 生成角色
  const characters = needCharacters
    ? await runStep(dir, config, "characters", onProgress, () =>
        fillTemplate(config.prompts.character, { world }),
      )
    : (emitSkip("characters", onProgress), novel.characters ?? "");

  // Step 3: 生成章节大纲
  if (needOutline) {
    const freshNovel = readNovel(dir);
    const prompt = fillTemplate(config.prompts.outline, {
      world,
      characters,
      total_chapters: String(freshNovel.target_chapters),
    });
    const result = await streamingStep(config, prompt, "outline", onProgress);
    const outline = parseOutlineText(result);
    writeOutline(dir, outline);
    return result;
  }
  emitSkip("outline", onProgress);
  return "";
}

// emit_skip：照搬 novel.rs:99-109，对跳过的步骤发一个 done:true 空事件
function emitSkip(step: string, onProgress: OutlineProgressHandler): void {
  onProgress(step, "", true);
  emitOutlineProgress({ step, chunk: "", done: true });
}

// 单步生成（world/characters），生成后写回 novel.md。照搬 novel.rs:116-145 的写回逻辑
async function runStep(
  dir: string,
  config: AppConfig,
  step: Extract<OutlineStep, "world" | "characters">,
  onProgress: OutlineProgressHandler,
  buildPrompt: () => string,
): Promise<string> {
  const prompt = buildPrompt();
  const result = await streamingStep(config, prompt, step, onProgress);
  const n = readNovel(dir);
  if (step === "world") {
    n.world = result;
  } else {
    n.characters = result;
  }
  writeNovel(dir, n);
  return result;
}

// streaming_step，照搬 novel.rs:171-211
// 流式生成，每个 chunk 推送 outline-progress(done:false)；完成时推送 done:true
async function streamingStep(
  config: AppConfig,
  prompt: string,
  step: string,
  onProgress: OutlineProgressHandler,
): Promise<string> {
  const result = await generateStreaming(config, prompt, (chunk) => {
    onProgress(step, chunk, false);
    emitOutlineProgress({ step, chunk, done: false });
  });
  // 发送完成事件
  onProgress(step, "", true);
  emitOutlineProgress({ step, chunk: "", done: true });
  return result;
}

// create_novel，照搬 novel.rs:36-77
export function createNovel(
  dir: string,
  title: string,
  genre: string,
  theme: string,
  chapters: number,
  config: AppConfig,
  overwrite: boolean,
): void {
  const novelPath = `${dir}/novel.md`;
  if (fs.existsSync(novelPath) && !overwrite) {
    const existing = readNovel(dir);
    throw AppError.novelAlreadyExists(existing.title);
  }

  // 覆盖时清理旧数据
  if (overwrite) {
    const outlinePath = `${dir}/outline.md`;
    if (fs.existsSync(outlinePath)) {
      try {
        fs.unlinkSync(outlinePath);
        fs.unlinkSync(`${outlinePath}.bak`);
      } catch {
        // Rust: let _ = 忽略
      }
    }
    const chaptersDirPath = `${dir}/chapters`;
    if (fs.existsSync(chaptersDirPath)) {
      try {
        fs.rmSync(chaptersDirPath, { recursive: true });
      } catch {
        // 忽略
      }
    }
  }

  const data: NovelData = {
    title,
    genre,
    theme,
    target_chapters: chapters,
    words_per_chapter: 3000,
    model: config.model,
    created: today(),
    world: undefined,
    characters: undefined,
  };
  writeNovel(dir, data);
  // 写入默认空 context（ContextData::default()）
  writeContext(dir, defaultContextData());
}

function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
