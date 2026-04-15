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
