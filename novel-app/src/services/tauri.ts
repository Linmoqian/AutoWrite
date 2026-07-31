// 前端访问后端的唯一入口。
// 原实现通过 Tauri invoke()/listen() 调 Rust；现改为 HTTP fetch + SSE 调 Node 后端。
// 函数签名全部保持不变，仅替换内部实现，组件层零改动。
//
// 通信约定：
// - 命令 → HTTP：GET 查询类，POST 写入/动作类，路径 /api/<command_name>
// - 事件 → 单一 SSE /events 流，帧为 {type, payload}，按 type 分发
// - 错误：HTTP 422 响应 body 为中文字符串，throw Error(message) 供调用方 String(e) 消费

import type {
  AppConfig,
  ChapterContent,
  ChapterMeta,
  ChapterProgressEvent,
  ExportData,
  ImageProgressEvent,
  ImageResult,
  NovelStatus,
  OllamaModel,
  OllamaTestResult,
  OutlineGenerationStatus,
  OutlineProgressEvent,
  Prompts,
  SceneDescription,
} from "../types";

// ===== HTTP 基础封装 =====

async function httpGet<T>(path: string): Promise<T> {
  const resp = await fetch(path);
  if (!resp.ok) {
    // 422 时 body 为中文字符串；其它错误用 status text
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

async function httpPost<T>(path: string, body?: unknown): Promise<T> {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }
  // 部分端点返回 null
  const text = await resp.text();
  if (text === "") return null as T;
  return JSON.parse(text) as T;
}

// ===== SSE 订阅复用 =====
// 单一 EventSource 连接 /events，按 type 分发到各 handler。
// UnlistenFn 语义保持：返回一个取消订阅函数（listen 包装为 Promise）。

type EventType = "outline-progress" | "chapter-progress" | "image-progress";
type AnyPayload = OutlineProgressEvent | ChapterProgressEvent | ImageProgressEvent;

let sharedEventSource: EventSource | null = null;
const subscribers = new Map<EventType, Set<(payload: AnyPayload) => void>>();

function getSharedEventSource(): EventSource {
  if (sharedEventSource && sharedEventSource.readyState !== EventSource.CLOSED) {
    return sharedEventSource;
  }
  sharedEventSource = new EventSource("/events");
  sharedEventSource.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as { type: string; payload: unknown };
      const subs = subscribers.get(msg.type as EventType);
      if (subs) {
        for (const fn of subs) fn(msg.payload as AnyPayload);
      }
    } catch {
      // 忽略解析异常
    }
  };
  return sharedEventSource;
}

export type UnlistenFn = () => void;

function subscribe(
  type: EventType,
  handler: (payload: AnyPayload) => void,
): UnlistenFn {
  let set = subscribers.get(type);
  if (!set) {
    set = new Set();
    subscribers.set(type, set);
  }
  set.add(handler);
  getSharedEventSource();
  return () => {
    set?.delete(handler);
  };
}

// listen 包装为 Promise<UnlistenFn> 以保持原签名
function subscribeAsync<T extends AnyPayload>(
  type: EventType,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  return Promise.resolve(subscribe(type, handler as (p: AnyPayload) => void));
}

// ===== 命令封装（签名与原 invoke 版本完全一致）=====

// select_novel_dir：Tauri 薄层仍提供原生文件夹选择（拿路径），再 POST 给 Node。
// 浏览器 dev 模式无 Tauri 时抛清晰错误。
export async function selectNovelDir(): Promise<string> {
  // 检测 Tauri 环境（阶段 6 后薄层仍注入）
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI_INTERNALS__) {
    const { invoke } = await import("@tauri-apps/api/core");
    const dir = await invoke<string>("select_novel_dir");
    return dir;
  }
  throw new Error("当前环境不支持文件夹选择，请在桌面应用中操作");
}

export async function getNovelDir(): Promise<string | null> {
  return httpGet<string | null>("/api/get_novel_dir");
}

export async function createNovel(
  title: string,
  genre: string,
  theme: string,
  chapters: number,
  overwrite = false,
  promptsOverride?: Prompts,
): Promise<void> {
  await httpPost<null>("/api/create_novel", {
    title,
    genre,
    theme,
    chapters,
    overwrite,
    promptsOverride,
  });
}

export async function generateOutline(): Promise<string> {
  return httpPost<string>("/api/generate_outline");
}

export async function startOutlineGeneration(step?: string): Promise<void> {
  await httpPost<null>("/api/start_outline_generation", { step });
}

export async function getOutlineGenerationStatus(): Promise<OutlineGenerationStatus> {
  return httpGet<OutlineGenerationStatus>("/api/get_outline_generation_status");
}

export async function generateChapter(): Promise<number> {
  return httpPost<number>("/api/generate_chapter");
}

export async function getStatus(): Promise<NovelStatus> {
  return httpGet<NovelStatus>("/api/get_status");
}

export async function listChapters(): Promise<ChapterMeta[]> {
  return httpGet<ChapterMeta[]>("/api/list_chapters");
}

export async function readChapter(filename: string): Promise<ChapterContent> {
  return httpGet<ChapterContent>(`/api/read_chapter?filename=${encodeURIComponent(filename)}`);
}

export async function loadConfig(): Promise<AppConfig> {
  return httpGet<AppConfig>("/api/load_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await httpPost<null>("/api/save_config", config);
}

export function onOutlineProgress(
  handler: (e: OutlineProgressEvent) => void,
): Promise<UnlistenFn> {
  return subscribeAsync("outline-progress", handler);
}

export function onChapterProgress(
  handler: (e: ChapterProgressEvent) => void,
): Promise<UnlistenFn> {
  return subscribeAsync("chapter-progress", handler);
}

export async function ollamaListModels(): Promise<OllamaModel[]> {
  return httpGet<OllamaModel[]>("/api/ollama_list_models");
}

export async function ollamaTestConnection(): Promise<OllamaTestResult> {
  return httpGet<OllamaTestResult>("/api/ollama_test_connection");
}

export interface ConnectionTestResult {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

export async function testAiConnection(): Promise<ConnectionTestResult> {
  return httpGet<ConnectionTestResult>("/api/test_ai_connection");
}

export async function getExportData(): Promise<ExportData> {
  return httpGet<ExportData>("/api/get_export_data");
}

// export_novel：后端返回 {content, defaultName}，前端用 Blob 下载。
// 原签名返回 string（保存路径）；改为返回内容字符串 + 默认文件名，调用方需适配。
// 为保持调用方零改动，这里仍返回字符串（内容），默认文件名通过命名约定处理。
export async function exportNovel(format: "md" | "txt"): Promise<string> {
  const result = await httpPost<{ content: string; defaultName: string }>(
    "/api/export_novel",
    { format },
  );
  return result.content;
}

// save_export_file：原走 Tauri 保存对话框；Node 后端无对话框，改为浏览器 Blob 下载。
export async function saveExportFile(
  content: number[],
  filename: string,
  extension: string,
): Promise<string> {
  const blob = new Blob([new Uint8Array(content)], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return a.download;
}

// ===== 图片生成 =====

export async function generateCover(): Promise<ImageResult> {
  return httpPost<ImageResult>("/api/generate_cover");
}

export async function generateCharacterImage(
  characterName: string,
  characterDesc: string,
): Promise<ImageResult> {
  return httpPost<ImageResult>("/api/generate_character_image", {
    characterName,
    characterDesc,
  });
}

export async function generateSceneImage(
  chapterNum: number,
  sceneDesc: string,
  mood: string,
): Promise<ImageResult> {
  return httpPost<ImageResult>("/api/generate_scene_image", {
    chapterNum,
    sceneDesc,
    mood,
  });
}

export async function extractSceneDescription(
  chapterNum: number,
): Promise<SceneDescription> {
  return httpPost<SceneDescription>("/api/extract_scene_description", { chapterNum });
}

export async function listImages(): Promise<ImageResult[]> {
  return httpGet<ImageResult[]>("/api/list_images");
}

export async function deleteImage(imageId: string): Promise<void> {
  await httpPost<null>("/api/delete_image", { imageId });
}

export async function getImagePath(filename: string): Promise<string> {
  return httpGet<string>(`/api/get_image_path?filename=${encodeURIComponent(filename)}`);
}

export function onImageProgress(
  handler: (e: ImageProgressEvent) => void,
): Promise<UnlistenFn> {
  return subscribeAsync("image-progress", handler);
}
