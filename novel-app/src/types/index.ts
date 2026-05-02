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

export interface AppConfig {
  novel_dir?: string;
  model: string;
  timeout: number;
  ollama_url: string;
  prompts: Prompts;
}
