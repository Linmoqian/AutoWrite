export interface NovelItem {
  index: number;
  title: string;
  genre: string;
  theme: string;
  target_chapters: number;
  current_chapter: number;
  total_words: number;
  model: string;
  created: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface StatusInfo {
  model: string;
  elapsed: string;
  session_chapters: number;
  auto_running: boolean;
}

export interface CreateNovelRequest {
  title: string;
  genre: string;
  theme: string;
  target_chapters: number;
  words_per_chapter: number;
}

export interface ChapterContent {
  num: number;
  title: string;
  words: number;
  created: string;
  body: string;
}

export interface GenreOption {
  value: string;
  label: string;
}

export type ViewMode = 'dashboard' | 'reader';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type ReaderTheme = 'dark' | 'light' | 'sepia' | 'green';

export interface OllamaStatus {
  connected: boolean;
  models: string[];
  default: string;
  error?: string;
}
