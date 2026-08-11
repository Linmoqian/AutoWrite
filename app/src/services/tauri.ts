import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppConfig,
  ChapterContent,
  ChapterMeta,
  ChapterProgressEvent,
  ConnectionTestResult,
  ExportData,
  ExportFormat,
  ImageKind,
  ImageProgressEvent,
  ImageResult,
  NovelStatus,
  OllamaModel,
  OllamaTestResult,
  OutlineGenerationStatus,
  OutlineProgressEvent,
  OutlineStep,
  Prompts,
  SceneDescription,
} from "@/types";

// ═══════════════════════════════════════════
// 统一错误处理包装
// ═══════════════════════════════════════════

export async function invokeSafe<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg);
  }
}

// ═══════════════════════════════════════════
// System 命令（3 个）
// ═══════════════════════════════════════════

export async function selectNovelDir(): Promise<string> {
  return invokeSafe<string>("select_novel_dir");
}

export async function getNovelDir(): Promise<string | null> {
  return invokeSafe<string | null>("get_novel_dir");
}

export async function testAiConnection(): Promise<ConnectionTestResult> {
  return invokeSafe<ConnectionTestResult>("test_ai_connection");
}

// ═══════════════════════════════════════════
// Novel 命令（8 个）
// ═══════════════════════════════════════════

export async function createNovel(
  title: string,
  genre: string,
  theme: string,
  chapters: number,
  overwrite = false,
  promptsOverride?: Prompts,
): Promise<void> {
  return invokeSafe("create_novel", {
    title,
    genre,
    theme,
    chapters,
    overwrite,
    promptsOverride,
  });
}

export async function generateOutline(): Promise<string> {
  return invokeSafe<string>("generate_outline");
}

export async function startOutlineGeneration(step?: OutlineStep): Promise<void> {
  return invokeSafe("start_outline_generation", { step });
}

export async function getOutlineGenerationStatus(): Promise<OutlineGenerationStatus> {
  return invokeSafe<OutlineGenerationStatus>("get_outline_generation_status");
}

export async function generateChapter(): Promise<number> {
  return invokeSafe<number>("generate_chapter");
}

export async function getStatus(): Promise<NovelStatus> {
  return invokeSafe<NovelStatus>("get_status");
}

export async function listChapters(): Promise<ChapterMeta[]> {
  return invokeSafe<ChapterMeta[]>("list_chapters");
}

export async function readChapter(filename: string): Promise<ChapterContent> {
  return invokeSafe<ChapterContent>("read_chapter", { filename });
}

// ═══════════════════════════════════════════
// Config 命令（4 个）
// ═══════════════════════════════════════════

export async function loadConfig(): Promise<AppConfig> {
  return invokeSafe<AppConfig>("load_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  return invokeSafe("save_config", { config });
}

export async function ollamaListModels(): Promise<OllamaModel[]> {
  return invokeSafe<OllamaModel[]>("ollama_list_models");
}

export async function ollamaTestConnection(): Promise<OllamaTestResult> {
  return invokeSafe<OllamaTestResult>("ollama_test_connection");
}

// ═══════════════════════════════════════════
// Export 命令（3 个）
// ═══════════════════════════════════════════

export async function getExportData(): Promise<ExportData> {
  return invokeSafe<ExportData>("get_export_data");
}

export async function exportNovel(format: ExportFormat): Promise<string> {
  return invokeSafe<string>("export_novel", { format });
}

export async function saveExportFile(
  content: number[],
  filename: string,
  extension: string,
): Promise<string> {
  return invokeSafe<string>("save_export_file", { content, filename, extension });
}

// ═══════════════════════════════════════════
// Image 命令（7 个）
// ═══════════════════════════════════════════

export async function generateCover(): Promise<ImageResult> {
  return invokeSafe<ImageResult>("generate_cover");
}

export async function generateCharacterImage(
  characterName: string,
  characterDesc: string,
): Promise<ImageResult> {
  return invokeSafe<ImageResult>("generate_character_image", {
    characterName,
    characterDesc,
  });
}

export async function generateSceneImage(
  chapterNum: number,
  sceneDesc: string,
  mood: string,
): Promise<ImageResult> {
  return invokeSafe<ImageResult>("generate_scene_image", {
    chapterNum,
    sceneDesc,
    mood,
  });
}

export async function extractSceneDescription(
  chapterNum: number,
): Promise<SceneDescription> {
  return invokeSafe<SceneDescription>("extract_scene_description", {
    chapterNum,
  });
}

export async function listImages(): Promise<ImageResult[]> {
  return invokeSafe<ImageResult[]>("list_images");
}

export async function deleteImage(imageId: string): Promise<void> {
  return invokeSafe("delete_image", { imageId });
}

export async function getImagePath(filename: string): Promise<string> {
  return invokeSafe<string>("get_image_path", { filename });
}

// ═══════════════════════════════════════════
// 事件监听（4 个）
// ═══════════════════════════════════════════

export function onOutlineProgress(
  handler: (e: OutlineProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<OutlineProgressEvent>("outline-progress", (e) =>
    handler(e.payload),
  );
}

export function onChapterProgress(
  handler: (e: ChapterProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<ChapterProgressEvent>("chapter-progress", (e) =>
    handler(e.payload),
  );
}

export function onOutlineGenerationStatus(
  handler: (e: OutlineGenerationStatus) => void,
): Promise<UnlistenFn> {
  return listen<OutlineGenerationStatus>("outline-generation-status", (e) =>
    handler(e.payload),
  );
}

export function onImageProgress(
  handler: (e: ImageProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<ImageProgressEvent>("image-progress", (e) => handler(e.payload));
}

// ── 图片类型标签（供 UI 使用）──
export const IMAGE_KIND_LABEL: Record<ImageKind, string> = {
  cover: "封面",
  character: "角色",
  scene: "场景",
};
