// ═══════════════════════════════════════════
// AutoWrite TypeScript 类型定义
// 对应 Rust DTO（serde rename_all = "camelCase"）
// 按 SPEC 6.3 节定义
// ═══════════════════════════════════════════

// ── 小说元数据 ──
export interface NovelData {
  title: string;
  genre: string;
  theme: string;
  targetChapters: number;
  worldView: string;
  characters: string;
  createdAt: string;
}

// ── 大纲 ──
export interface Volume {
  title: string;
  chapters: ChapterEntry[];
}

export interface ChapterEntry {
  number: number;
  title: string;
  summary: string;
}

// ── 三层叙事记忆 ──
export interface ContextData {
  characterStates: CharacterState[];
  plotEvents: PlotEvent[];
  unresolvedThreads: TensionItem[];
  emotionalArc: EmotionalTag[];
  currentIntent: NarrativeIntent;
}

export interface CharacterState {
  name: string;
  location: string;
  powerLevel: string;
  status: string;
}

export interface PlotEvent {
  chapter: number;
  event: string;
}

export interface TensionItem {
  item: string;
  status: "open" | "resolved";
}

export interface EmotionalTag {
  chapter: number;
  tag: string;
  intensity: number;
}

export interface NarrativeIntent {
  characterWants: string;
  obstacle: string;
  readerShouldCare: string;
}

// ── 章节元数据 ──
export interface ChapterMeta {
  filename: string;
  number: number;
  title: string;
  wordCount: number;
  createdAt: string;
}

export interface ChapterContent {
  meta: ChapterMeta;
  body: string;
}

// ── 小说状态 ──
export interface NovelStatus {
  novel: NovelData;
  context: ContextData;
  outline: Volume[];
  totalChapters: number;
  writtenChapters: number;
}

// ── 应用配置 ──
export interface AppConfig {
  provider: Provider;
  openai: OpenAiConfig;
  ollama: OllamaConfig;
  prompts: Prompts;
  image: ImageConfig;
}

// Claude / Gemini / LlamaCpp 复用 openai 段（apiKey/apiUrl/model/timeout），
// 不新增 DTO 字段，保持配置结构稳定。
export type Provider = "openai" | "ollama" | "claude" | "gemini" | "llamacpp";

export interface OpenAiConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  timeout: number;
}

export interface OllamaConfig {
  apiUrl: string;
  model: string;
  timeout: number;
  numCtx: number;
}

export interface Prompts {
  worldView: string;
  characters: string;
  outline: string;
  chapter: string;
}

export interface ImageConfig {
  model: string;
  apiUrl: string;
  apiToken: string;
  loras: LoraConfig[];
  size: string;
}

export interface LoraConfig {
  name: string;
  weight: number;
}

// ── 大纲生成 ──
export type OutlineStep = "worldView" | "characters" | "outline";

export interface OutlineProgressEvent {
  step: OutlineStep;
  chunk: string;
  done: boolean;
}

export interface OutlineGenerationStatus {
  running: boolean;
  completed: boolean;
  currentStep?: OutlineStep;
  streamingText: Partial<Record<OutlineStep, string>>;
  error?: string;
}

// ── 章节流式 ──
export interface ChapterProgressEvent {
  chunk: string;
  done: boolean;
}

// ── 连接测试 ──
export interface ConnectionTestResult {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

// ── Ollama ──
export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}

export interface OllamaTestResult {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

// ── 导出 ──
export type ExportFormat = "md" | "txt" | "docx" | "pdf";

export interface ExportChapter {
  number: number;
  title: string;
  wordCount: number;
  body: string;
}

export interface ExportData {
  novel: NovelData;
  outline: Volume[];
  chapters: ExportChapter[];
}

// ── 图片 ──
export type ImageKind = "cover" | "character" | "scene";

export interface ImageResult {
  id: string;
  kind: ImageKind;
  prompt: string;
  filename: string;
  refText: string;
  createdAt: string;
}

export interface ImageProgressEvent {
  stage:
    | "preparing"
    | "submitting"
    | "polling"
    | "downloading"
    | "saving"
    | "done";
  message: string;
  imageId?: string;
}

export interface SceneDescription {
  sceneDesc: string;
  mood: string;
}

// ── 副驾驶聊天 ──
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string; // ISO 8601 (RFC3339)
}

// 流式分块事件（对齐后端 ChatChunkEvent，camelCase）
export interface ChatChunkEvent {
  chunk: string;
  done: boolean;
  messageId: string;
}

// ── 批量场景插图 ──
export type BatchChapterStatusKind = "pending" | "running" | "done" | "failed";

export interface BatchChapterStatus {
  chapter: number;
  status: BatchChapterStatusKind;
  message?: string | null;
}

export interface BatchImageProgress {
  total: number;
  completed: number;
  failed: number;
  currentChapter?: number | null;
  currentMessage?: string | null;
  chapters: BatchChapterStatus[];
}
