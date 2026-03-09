// kanban/src/types/index.ts

export type NovelStatus = 'todo' | 'writing' | 'reviewing' | 'published';

export interface Novel {
  id: string;
  title: string;
  genre: string;
  theme: string;
  targetChapters: number;
  writtenChapters: number;
  status: NovelStatus;
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
  searchQuery: string;
  selectedGenre: string | null;
  setNovels: (novels: Novel[]) => void;
  moveNovel: (novelId: string, newStatus: NovelStatus) => void;
  setSearchQuery: (query: string) => void;
  setSelectedGenre: (genre: string | null) => void;
  addNovel: (novel: Novel) => void;
  updateNovel: (novel: Novel) => void;
  deleteNovel: (novelId: string) => void;
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
