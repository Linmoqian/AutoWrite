import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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

export async function selectNovelDir(): Promise<string> {
  return invoke<string>("select_novel_dir");
}

export async function getNovelDir(): Promise<string | null> {
  return invoke<string | null>("get_novel_dir");
}

export async function createNovel(
  title: string,
  genre: string,
  theme: string,
  chapters: number,
  overwrite = false,
  promptsOverride?: Prompts,
): Promise<void> {
  return invoke("create_novel", {
    title,
    genre,
    theme,
    chapters,
    overwrite,
    promptsOverride,
  });
}

export async function generateOutline(): Promise<string> {
  return invoke<string>("generate_outline");
}

export async function startOutlineGeneration(step?: string): Promise<void> {
  return invoke("start_outline_generation", { step });
}

export async function getOutlineGenerationStatus(): Promise<OutlineGenerationStatus> {
  return invoke<OutlineGenerationStatus>("get_outline_generation_status");
}

export async function generateChapter(): Promise<number> {
  return invoke<number>("generate_chapter");
}

export async function getStatus(): Promise<NovelStatus> {
  return invoke<NovelStatus>("get_status");
}

export async function listChapters(): Promise<ChapterMeta[]> {
  return invoke<ChapterMeta[]>("list_chapters");
}

export async function readChapter(filename: string): Promise<ChapterContent> {
  return invoke<ChapterContent>("read_chapter", { filename });
}

export async function loadConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("load_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  return invoke("save_config", { config });
}

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

export async function ollamaListModels(): Promise<OllamaModel[]> {
  return invoke<OllamaModel[]>("ollama_list_models");
}

export async function ollamaTestConnection(): Promise<OllamaTestResult> {
  return invoke<OllamaTestResult>("ollama_test_connection");
}

export interface ConnectionTestResult {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

export async function testAiConnection(): Promise<ConnectionTestResult> {
  return invoke<ConnectionTestResult>("test_ai_connection");
}

export async function getExportData(): Promise<ExportData> {
  return invoke<ExportData>("get_export_data");
}

export async function exportNovel(format: "md" | "txt"): Promise<string> {
  return invoke<string>("export_novel", { format });
}

export async function saveExportFile(
  content: number[],
  filename: string,
  extension: string,
): Promise<string> {
  return invoke<string>("save_export_file", { content, filename, extension });
}

// ===== 图片生成 =====

export async function generateCover(): Promise<ImageResult> {
  return invoke<ImageResult>("generate_cover");
}

export async function generateCharacterImage(
  characterName: string,
  characterDesc: string,
): Promise<ImageResult> {
  return invoke<ImageResult>("generate_character_image", {
    characterName,
    characterDesc,
  });
}

export async function generateSceneImage(
  chapterNum: number,
  sceneDesc: string,
  mood: string,
): Promise<ImageResult> {
  return invoke<ImageResult>("generate_scene_image", {
    chapterNum,
    sceneDesc,
    mood,
  });
}

export async function extractSceneDescription(
  chapterNum: number,
): Promise<SceneDescription> {
  return invoke<SceneDescription>("extract_scene_description", { chapterNum });
}

export async function listImages(): Promise<ImageResult[]> {
  return invoke<ImageResult[]>("list_images");
}

export async function deleteImage(imageId: string): Promise<void> {
  return invoke("delete_image", { imageId });
}

export async function getImagePath(filename: string): Promise<string> {
  return invoke<string>("get_image_path", { filename });
}

export function onImageProgress(
  handler: (e: ImageProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<ImageProgressEvent>("image-progress", (e) =>
    handler(e.payload),
  );
}
