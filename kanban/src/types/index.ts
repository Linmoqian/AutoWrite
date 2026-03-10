// kanban/src/types/index.ts

// 小说状态枚举
export enum NovelStatus {
  TODO = 'todo',
  WRITING = 'writing',
  REVIEWING = 'reviewing',
  PUBLISHED = 'published',
}

// 细粒度工作流状态枚举
export enum WorkflowStatus {
  OUTLINE = 'outline', // 大纲阶段
  OUTLINE_REVIEW = 'outline_review', // 大纲审核
  CHARACTER_DESIGN = 'character_design', // 角色设计
  WRITING = 'writing', // 写作中
  AI_REVIEW = 'ai_review', // AI 审核
  HUMAN_FINALIZATION = 'human_finalization', // 人工审核定稿
  PUBLISHED = 'published', // 已发布
}

// 章节状态枚举
export enum ChapterStatus {
  DRAFT = 'draft',
  REVIEWING = 'reviewing',
  FINALIZED = 'finalized',
}

// 角色类型枚举
export enum CharacterRole {
  PROTAGONIST = 'protagonist',
  ANTAGONIST = 'antagonist',
  SUPPORTING = 'supporting',
  MINOR = 'minor',
}

// 章节接口
export interface Chapter {
  id: string;
  novelId: string;
  number: number;
  title: string;
  content: string;
  wordCount: number;
  status: ChapterStatus;
  createdAt: string;
  updatedAt: string;
}

// 角色接口
export interface Character {
  id: string;
  novelId: string;
  name: string;
  role: CharacterRole;
  description: string;
  traits: string[];
}

export interface Novel {
  id: string;
  title: string;
  genre: string;
  theme: string;
  targetChapters: number;
  writtenChapters: number;
  status: NovelStatus;
  workflowStatus: WorkflowStatus;
  outline?: string;
  characters?: Character[];
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  description?: string;
}

export interface Column {
  id: NovelStatus;
  title: string;
  color: string;
  novels: Novel[];
}

export interface KanbanState {
  novels: Novel[];
  chapters: Chapter[];
  characters: Character[];
  searchQuery: string;
  selectedGenre: string | null;
  // 数据加载方法
  loadNovels: () => Promise<void>;
  loadChapters: (novelId: string) => Promise<void>;
  loadCharacters: (novelId: string) => Promise<void>;
  // 小说管理
  setNovels: (novels: Novel[]) => void;
  moveNovel: (novelId: string, newStatus: NovelStatus) => void;
  setSearchQuery: (query: string) => void;
  setSelectedGenre: (genre: string | null) => void;
  addNovel: (novel: Novel) => void;
  updateNovel: (novel: Novel) => void;
  deleteNovel: (novelId: string) => void;
  // 章节管理
  addChapter: (chapter: Chapter) => void;
  updateChapter: (chapter: Chapter) => void;
  deleteChapter: (chapterId: string) => void;
  getChaptersByNovelId: (novelId: string) => Chapter[];
  // 角色管理
  addCharacter: (character: Character) => void;
  updateCharacter: (character: Character) => void;
  deleteCharacter: (characterId: string) => void;
  getCharactersByNovelId: (novelId: string) => Character[];
  // 小说扩展方法
  updateNovelWorkflowStatus: (novelId: string, status: WorkflowStatus) => void;
  updateNovelOutline: (novelId: string, outline: string) => void;
}

export const COLUMN_CONFIG: Record<NovelStatus, { title: string; color: string }> = {
  [NovelStatus.TODO]: { title: '待写', color: 'bg-kanban-todo' },
  [NovelStatus.WRITING]: { title: '撰写中', color: 'bg-kanban-writing' },
  [NovelStatus.REVIEWING]: { title: '审核中', color: 'bg-kanban-reviewing' },
  [NovelStatus.PUBLISHED]: { title: '已发布', color: 'bg-kanban-published' },
};

export const STATUS_ORDER: NovelStatus[] = [
  NovelStatus.TODO,
  NovelStatus.WRITING,
  NovelStatus.REVIEWING,
  NovelStatus.PUBLISHED,
];

export const GENRE_OPTIONS = [
  { value: 'xuanhuan', label: '玄幻' },
  { value: 'dushi', label: '都市' },
  { value: 'yanqing', label: '言情' },
  { value: 'kehuan', label: '科幻' },
] as const;

// 工作流步骤配置
export const WORKFLOW_STEPS: { status: WorkflowStatus; label: string; description: string }[] = [
  { status: WorkflowStatus.OUTLINE, label: '大纲', description: '生成故事大纲' },
  { status: WorkflowStatus.OUTLINE_REVIEW, label: '大纲审核', description: '审核大纲' },
  { status: WorkflowStatus.CHARACTER_DESIGN, label: '角色设计', description: '设计主要角色' },
  { status: WorkflowStatus.WRITING, label: '写作', description: 'AI 自动写作' },
  { status: WorkflowStatus.AI_REVIEW, label: 'AI 审核', description: '机器审核内容' },
  { status: WorkflowStatus.HUMAN_FINALIZATION, label: '审核定稿', description: '人工审核并定稿' },
  { status: WorkflowStatus.PUBLISHED, label: '已发布', description: '发布到平台' },
];
