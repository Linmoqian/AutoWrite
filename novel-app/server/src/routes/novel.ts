// 小说核心路由：目录、创建、大纲、章节、状态。
// 对应 commands.rs 的 novel 相关命令 + start_outline_generation 后台任务状态管理。

import type { FastifyInstance } from "fastify";

import type { Prompts } from "../config.js";
import { AppError } from "../error.js";
import { listChapters, readChapter } from "../files/index.js";
import { configFromState, dirFromState } from "../lib/state-helpers.js";
import { emitOutlineGenerationStatus } from "../lib/sse.js";
import {
  createNovel,
  generateOutlineStreamingWithProgress,
} from "../logic/outline.js";
import { generateChapterStreaming } from "../logic/chapter.js";
import { getStatus } from "../logic/status.js";
import { getState } from "../state.js";

export function registerNovelRoutes(app: FastifyInstance): void {
  // select_novel_dir：前端通过 Tauri 对话框拿到路径后 POST 给 Node
  // body: { path: string }
  app.post("/api/select_novel_dir", async (req) => {
    const { path: dirPath } = (req.body ?? {}) as { path?: string };
    if (!dirPath || dirPath === "") {
      throw AppError.noNovelDir();
    }
    getState().novelDir = dirPath;
    // 持久化到配置（照搬 commands.rs:64-67）
    const { loadConfig, saveConfig } = await import("../config.js");
    const config = loadConfig(getState().configPath);
    config.novel_dir = dirPath;
    saveConfig(getState().configPath, config);
    return dirPath;
  });

  // get_novel_dir
  app.get("/api/get_novel_dir", () => getState().novelDir);

  // create_novel
  // body: { title, genre, theme, chapters, overwrite?, promptsOverride? }
  app.post("/api/create_novel", async (req) => {
    const dir = dirFromState();
    const config = configFromState();
    const body = (req.body ?? {}) as {
      title: string;
      genre: string;
      theme: string;
      chapters: number;
      overwrite?: boolean;
      promptsOverride?: Prompts;
    };
    const effectiveConfig =
      body.promptsOverride !== undefined
        ? { ...config, prompts: body.promptsOverride }
        : config;
    createNovel(
      dir,
      body.title,
      body.genre,
      body.theme,
      body.chapters,
      effectiveConfig,
      body.overwrite ?? false,
    );
    return null;
  });

  // generate_outline（同步全流程，返回 outline_text）
  app.post("/api/generate_outline", async () => {
    const dir = dirFromState();
    const config = configFromState();
    return generateOutlineStreamingWithProgress(dir, config, "", () => {});
  });

  // start_outline_generation：启动后台任务，立即返回。状态通过 get_outline_generation_status 查询。
  // body: { step?: string }
  app.post("/api/start_outline_generation", async (req) => {
    const dir = dirFromState();
    const config = configFromState();
    const body = (req.body ?? {}) as { step?: string };
    const targetStep = body.step ?? "";

    const state = getState();
    // 幂等：已在运行则直接返回（照搬 commands.rs:124-128）
    if (state.outlineGeneration.running) {
      return null;
    }
    state.outlineGeneration = {
      running: true,
      completed: false,
      currentStep: targetStep === "" ? undefined : (targetStep as "world" | "characters" | "outline"),
      streamingText: {},
      error: undefined,
    };

    // 后台执行（不 await）
    void runOutlineGeneration(dir, config, targetStep);

    return null;
  });

  // get_outline_generation_status
  app.get("/api/get_outline_generation_status", () => getState().outlineGeneration);

  // generate_chapter
  app.post("/api/generate_chapter", async () => {
    const dir = dirFromState();
    const config = configFromState();
    return generateChapterStreaming(dir, config);
  });

  // get_status
  app.get("/api/get_status", () => getStatus(dirFromState()));

  // list_chapters
  app.get("/api/list_chapters", () => listChapters(dirFromState()));

  // read_chapter?filename=xxx
  app.get("/api/read_chapter", async (req) => {
    const { filename } = req.query as { filename: string };
    const dir = dirFromState();
    return readChapter(dir, filename);
  });
}

// 后台大纲生成任务，照搬 commands.rs:139-170 的 spawn 逻辑。
// 完成时更新状态并推送 outline-generation-status 事件。
async function runOutlineGeneration(
  dir: string,
  config: ReturnType<typeof configFromState>,
  targetStep: string,
): Promise<void> {
  const state = getState();
  try {
    await generateOutlineStreamingWithProgress(
      dir,
      config,
      targetStep,
      (step, chunk, _done) => {
        // 更新流式文本状态（照搬 commands.rs:147-156）
        const s = state.outlineGeneration;
        s.currentStep = step as "world" | "characters" | "outline";
        if (chunk !== "") {
          s.streamingText[step as "world" | "characters" | "outline"] =
            (s.streamingText[step as "world" | "characters" | "outline"] ?? "") + chunk;
        }
      },
    );
    // 成功
    state.outlineGeneration.running = false;
    state.outlineGeneration.completed = true;
    state.outlineGeneration.error = undefined;
  } catch (e) {
    state.outlineGeneration.running = false;
    state.outlineGeneration.completed = false;
    const { errorToString, normalizeError } = await import("../error.js");
    state.outlineGeneration.error = errorToString(normalizeError(e));
  }
  // 推送最终状态快照（照搬 commands.rs:169）
  emitOutlineGenerationStatus({ ...state.outlineGeneration });
}
