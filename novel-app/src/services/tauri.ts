import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppConfig,
  ChapterContent,
  ChapterMeta,
  ChapterProgressEvent,
  NovelStatus,
  OutlineGenerationStatus,
  OutlineProgressEvent,
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
): Promise<void> {
  return invoke("create_novel", { title, genre, theme, chapters, overwrite });
}

export async function generateOutline(): Promise<string> {
  return invoke<string>("generate_outline");
}

export async function startOutlineGeneration(): Promise<void> {
  return invoke("start_outline_generation");
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
