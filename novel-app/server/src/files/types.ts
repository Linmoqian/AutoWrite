// 数据类型，对应 src-tauri/src/files.rs 的 serde 结构体（全部 snake_case 字段）。

export interface NovelData {
  title: string;
  genre: string;
  theme: string;
  target_chapters: number;
  words_per_chapter: number;
  model: string;
  created: string;
  world?: string; // serde skip_serializing_if = None
  characters?: string;
}

export interface ChapterEntry {
  num: number;
  title: string;
}

export interface Volume {
  volume: string;
  chapters: ChapterEntry[];
}

export interface EmotionalTag {
  tag: string;
  intensity: number;
}

export interface TensionItem {
  item: string;
  status: string; // "open" | "resolved"
}

export interface NarrativeIntent {
  character_wants: string;
  obstacle: string;
  reader_should_care: string;
}

// character_states 在内存里是任意对象（serde_yaml::Value），读写时序列化为字符串行
export interface ContextData {
  current_chapter: number;
  recent_summaries: string[];
  // 内存里为对象数组（merge_facts 产生）；写盘时拼成字符串行
  character_states: CharacterStateRaw[];
  pending_plots: string[];
  plot_events: string[];
  unresolved_threads: string[];
  emotional_arc: EmotionalTag[];
  tension_checklist: TensionItem[];
  current_intent?: NarrativeIntent;
}

// character_states 的元素：可能是对象（内存态）或字符串（从磁盘读回的行）
// Rust 用 serde_yaml::Value，此处用联合类型。novel.rs 的 merge_facts 产出对象；
// read_context 读回的是字符串。保持与 Rust 一致的弱类型。
export type CharacterStateRaw =
  | string
  | Record<string, unknown>;

export function defaultContextData(): ContextData {
  return {
    current_chapter: 0,
    recent_summaries: [],
    character_states: [],
    pending_plots: [],
    plot_events: [],
    unresolved_threads: [],
    emotional_arc: [],
    tension_checklist: [],
    current_intent: undefined,
  };
}

export interface ChapterMeta {
  chapter: number;
  title: string;
  words: number;
  created: string;
}
