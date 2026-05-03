export interface NovelData {
  title: string;
  genre: string;
  theme: string;
  target_chapters: number;
  words_per_chapter: number;
  model: string;
  created: string;
  world?: string;
  characters?: string;
}

export interface Volume {
  volume: string;
  chapters: ChapterEntry[];
}

export interface ChapterEntry {
  num: number;
  title: string;
}

export interface ContextData {
  current_chapter: number;
  recent_summaries: string[];
  character_states: string[];
  pending_plots: string[];
}

export interface ChapterMeta {
  chapter: number;
  title: string;
  words: number;
  created: string;
}

export interface ChapterContent {
  meta: ChapterMeta;
  body: string;
}

export interface NovelStatus {
  novel: NovelData;
  context: ContextData;
  outline: Volume[];
  total_chapters: number;
  written_chapters: number;
}

export interface Prompts {
  world: string;
  character: string;
  outline: string;
  chapter: string;
}

export type Provider = "openai" | "ollama";

export interface AppConfig {
  novel_dir?: string;
  provider: Provider;
  model: string;
  timeout: number;
  ollama_url: string;
  api_base_url: string;
  api_key: string;
  prompts: Prompts;
}

export interface OutlineProgressEvent {
  step: "world" | "characters" | "outline";
  chunk: string;
  done: boolean;
}

export interface OutlineGenerationStatus {
  running: boolean;
  completed: boolean;
  currentStep?: "world" | "characters" | "outline";
  streamingText: Partial<Record<"world" | "characters" | "outline", string>>;
  error?: string;
}

export interface ChapterProgressEvent {
  chunk: string;
  done: boolean;
}
