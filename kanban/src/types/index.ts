// kanban/src/types/index.ts

export type NovelStatus = 'todo' | 'writing' | 'reviewing' | 'published';

// 细粒度工作流状态
export type WorkflowStatus =
  | 'outline'          // 大纲阶段
  | 'outline_review'   // 大纲审核
  | 'character_design' // 角色设计
  | 'writing'          // 写作中
  | 'ai_review'        // AI 审核
  | 'human_finalization' // 人工审核定稿
  | 'published';       // 已发布

// 章节接口
export interface Chapter {
  id: string;
  novelId: string;
  number: number;
  title: string;
  content: string;
  wordCount: number;
  status: 'draft' | 'reviewing' | 'finalized';
  createdAt: string;
  updatedAt: string;
}

// 角色接口
export interface Character {
  id: string;
  novelId: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
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
  todo: { title: '待写', color: 'bg-kanban-todo' },
  writing: { title: '撰写中', color: 'bg-kanban-writing' },
  reviewing: { title: '审核中', color: 'bg-kanban-reviewing' },
  published: { title: '已发布', color: 'bg-kanban-published' },
};

export const STATUS_ORDER: NovelStatus[] = ['todo', 'writing', 'reviewing', 'published'];

export const GENRE_OPTIONS = [
  { value: 'xuanhuan', label: '玄幻' },
  { value: 'dushi', label: '都市' },
  { value: 'yanqing', label: '言情' },
  { value: 'kehuan', label: '科幻' },
] as const;

// 工作流步骤配置
export const WORKFLOW_STEPS: { status: WorkflowStatus; label: string; description: string }[] = [
  { status: 'outline', label: '大纲', description: '生成故事大纲' },
  { status: 'outline_review', label: '大纲审核', description: '审核大纲' },
  { status: 'character_design', label: '角色设计', description: '设计主要角色' },
  { status: 'writing', label: '写作', description: 'AI 自动写作' },
  { status: 'ai_review', label: 'AI 审核', description: '机器审核内容' },
  { status: 'human_finalization', label: '审核定稿', description: '人工审核并定稿' },
  { status: 'published', label: '已发布', description: '发布到平台' },
];
