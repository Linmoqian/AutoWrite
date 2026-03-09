# 小说创作看板管理实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个独立的 Next.js 看板应用，用于管理小说创作进度（待写 → 撰写中 → 审核中 → 已发布），支持拖拽排序、数据持久化和筛选搜索。

**Architecture:** 采用 Next.js 16 App Router + TypeScript，使用 @dnd-kit 实现拖拽，Tailwind CSS 样式，zustand 状态管理，数据通过 API 与现有 Python 后端同步，同时支持本地持久化。

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, @dnd-kit/core, @dnd-kit/sortable, zustand, lucide-react

---

## Phase 1: 项目初始化

### Task 1: 创建 Next.js 项目

**Files:**
- Create: `kanban/package.json`
- Create: `kanban/tsconfig.json`
- Create: `kanban/next.config.ts`
- Create: `kanban/tailwind.config.ts`
- Create: `kanban/postcss.config.mjs`

**Step 1: 创建项目目录并初始化**

```bash
mkdir -p D:/project/WriteOnMac/kanban
cd D:/project/WriteOnMac/kanban
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

**Step 2: 安装依赖**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities zustand lucide-react clsx tailwind-merge
```

**Step 3: 验证项目结构**

```bash
ls src/app
# 应看到: layout.tsx page.tsx globals.css
```

**Step 4: 启动开发服务器验证**

```bash
npm run dev
# 访问 http://localhost:3000 确认页面正常
```

**Step 5: 提交**

```bash
git add kanban/
git commit -m "feat(kanban): 初始化 Next.js 项目结构"
```

---

### Task 2: 配置 Tailwind CSS 主题

**Files:**
- Modify: `kanban/tailwind.config.ts`
- Modify: `kanban/src/app/globals.css`

**Step 1: 更新 tailwind.config.ts 添加自定义主题**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kanban: {
          todo: "#f97316",      // 橙色 - 待写
          writing: "#3b82f6",   // 蓝色 - 撰写中
          reviewing: "#a855f7", // 紫色 - 审核中
          published: "#22c55e", // 绿色 - 已发布
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 2: 更新 globals.css 添加基础样式**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0f172a;
  --foreground: #f8fafc;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: system-ui, -apple-system, sans-serif;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
```

**Step 3: 验证样式生效**

```bash
npm run dev
# 页面背景应为深色 (#0f172a)
```

**Step 4: 提交**

```bash
git add kanban/tailwind.config.ts kanban/src/app/globals.css
git commit -m "feat(kanban): 配置 Tailwind CSS 主题和全局样式"
```

---

## Phase 2: 类型定义和数据层

### Task 3: 定义 TypeScript 类型

**Files:**
- Create: `kanban/src/types/index.ts`

**Step 1: 创建类型定义文件**

```typescript
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
```

**Step 2: 验证类型编译**

```bash
cd kanban && npx tsc --noEmit
# 应无错误
```

**Step 3: 提交**

```bash
git add kanban/src/types/
git commit -m "feat(kanban): 定义小说和看板类型"
```

---

### Task 4: 创建 Zustand 状态管理

**Files:**
- Create: `kanban/src/store/kanbanStore.ts`
- Create: `kanban/src/store/index.ts`

**Step 1: 创建 zustand store**

```typescript
// kanban/src/store/kanbanStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KanbanState, Novel, NovelStatus } from '@/types';

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set) => ({
      novels: [],
      searchQuery: '',
      selectedGenre: null,

      setNovels: (novels) => set({ novels }),

      moveNovel: (novelId, newStatus) =>
        set((state) => ({
          novels: state.novels.map((novel) =>
            novel.id === novelId
              ? { ...novel, status: newStatus, updatedAt: new Date().toISOString() }
              : novel
          ),
        })),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setSelectedGenre: (genre) => set({ selectedGenre: genre }),

      addNovel: (novel) =>
        set((state) => ({ novels: [...state.novels, novel] })),

      updateNovel: (novel) =>
        set((state) => ({
          novels: state.novels.map((n) => (n.id === novel.id ? novel : n)),
        })),

      deleteNovel: (novelId) =>
        set((state) => ({
          novels: state.novels.filter((n) => n.id !== novelId),
        })),
    }),
    {
      name: 'kanban-storage',
    }
  )
);
```

**Step 2: 创建 store 导出**

```typescript
// kanban/src/store/index.ts
export { useKanbanStore } from './kanbanStore';
```

**Step 3: 验证 store 类型**

```bash
cd kanban && npx tsc --noEmit
```

**Step 4: 提交**

```bash
git add kanban/src/store/
git commit -m "feat(kanban): 添加 Zustand 状态管理和本地持久化"
```

---

## Phase 3: 可复用组件

### Task 5: 创建工具函数

**Files:**
- Create: `kanban/src/lib/utils.ts`

**Step 1: 创建工具函数**

```typescript
// kanban/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return `novel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatWordCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万字`;
  }
  return `${count}字`;
}
```

**Step 2: 提交**

```bash
git add kanban/src/lib/
git commit -m "feat(kanban): 添加工具函数"
```

---

### Task 6: 创建小说卡片组件

**Files:**
- Create: `kanban/src/components/NovelCard.tsx`

**Step 1: 创建小说卡片组件**

```typescript
// kanban/src/components/NovelCard.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Edit2 } from 'lucide-react';
import type { Novel } from '@/types';
import { cn, formatDate, formatWordCount } from '@/lib/utils';
import { GENRE_OPTIONS } from '@/types';

interface NovelCardProps {
  novel: Novel;
  onEdit?: (novel: Novel) => void;
  onDelete?: (novelId: string) => void;
}

export function NovelCard({ novel, onEdit, onDelete }: NovelCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: novel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const genreLabel = GENRE_OPTIONS.find((g) => g.value === novel.genre)?.label || novel.genre;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-slate-800 rounded-lg p-4 cursor-grab active:cursor-grabbing',
        'border border-slate-700 hover:border-slate-600',
        'transition-all duration-200',
        isDragging && 'opacity-50 shadow-lg shadow-black/50 scale-105'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 text-slate-500 hover:text-slate-400 cursor-grab"
        >
          <GripVertical size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate">{novel.title}</h3>
          <p className="text-sm text-slate-400 mt-1">
            {genreLabel} · {novel.theme}
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit?.(novel)}
            className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete?.(novel.id)}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {novel.writtenChapters}/{novel.targetChapters} 章
        </span>
        <span>{formatWordCount(novel.wordCount)}</span>
      </div>

      <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
          style={{
            width: `${(novel.writtenChapters / novel.targetChapters) * 100}%`,
          }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-600">
        更新于 {formatDate(novel.updatedAt)}
      </p>
    </div>
  );
}
```

**Step 2: 验证组件编译**

```bash
cd kanban && npx tsc --noEmit
```

**Step 3: 提交**

```bash
git add kanban/src/components/NovelCard.tsx
git commit -m "feat(kanban): 创建可拖拽的小说卡片组件"
```

---

### Task 7: 创建看板列组件

**Files:**
- Create: `kanban/src/components/KanbanColumn.tsx`

**Step 1: 创建看板列组件**

```typescript
// kanban/src/components/KanbanColumn.tsx
'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Novel, NovelStatus } from '@/types';
import { COLUMN_CONFIG } from '@/types';
import { NovelCard } from './NovelCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  id: NovelStatus;
  novels: Novel[];
  onAddNovel?: (status: NovelStatus) => void;
  onEditNovel?: (novel: Novel) => void;
  onDeleteNovel?: (novelId: string) => void;
}

export function KanbanColumn({
  id,
  novels,
  onAddNovel,
  onEditNovel,
  onDeleteNovel,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const config = COLUMN_CONFIG[id];
  const novelIds = novels.map((n) => n.id);

  return (
    <div className="flex flex-col min-w-[300px] max-w-[300px]">
      {/* 列标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn('w-3 h-3 rounded-full', config.color)} />
          <h2 className="font-semibold text-white">{config.title}</h2>
          <span className="text-sm text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {novels.length}
          </span>
        </div>
        <button
          onClick={() => onAddNovel?.(id)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* 放置区域 */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 rounded-lg transition-colors min-h-[200px]',
          isOver ? 'bg-slate-700/50' : 'bg-slate-800/30'
        )}
      >
        <SortableContext items={novelIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {novels.map((novel) => (
              <NovelCard
                key={novel.id}
                novel={novel}
                onEdit={onEditNovel}
                onDelete={onDeleteNovel}
              />
            ))}
          </div>
        </SortableContext>

        {novels.length === 0 && (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
            暂无小说
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: 验证组件编译**

```bash
cd kanban && npx tsc --noEmit
```

**Step 3: 提交**

```bash
git add kanban/src/components/KanbanColumn.tsx
git commit -m "feat(kanban): 创建看板列组件"
```

---

### Task 8: 创建筛选搜索组件

**Files:**
- Create: `kanban/src/components/SearchFilter.tsx`

**Step 1: 创建筛选搜索组件**

```typescript
// kanban/src/components/SearchFilter.tsx
'use client';

import { Search, X } from 'lucide-react';
import { GENRE_OPTIONS } from '@/types';
import { cn } from '@/lib/utils';

interface SearchFilterProps {
  searchQuery: string;
  selectedGenre: string | null;
  onSearchChange: (query: string) => void;
  onGenreChange: (genre: string | null) => void;
}

export function SearchFilter({
  searchQuery,
  selectedGenre,
  onSearchChange,
  onGenreChange,
}: SearchFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* 搜索框 */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索小说标题..."
          className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg
                     text-white placeholder-slate-500 focus:outline-none focus:border-blue-500
                     transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 类型筛选 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">类型:</span>
        <div className="flex gap-1">
          <button
            onClick={() => onGenreChange(null)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              selectedGenre === null
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            )}
          >
            全部
          </button>
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre.value}
              onClick={() => onGenreChange(genre.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                selectedGenre === genre.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              )}
            >
              {genre.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 提交**

```bash
git add kanban/src/components/SearchFilter.tsx
git commit -m "feat(kanban): 创建搜索筛选组件"
```

---

### Task 9: 创建小说编辑弹窗组件

**Files:**
- Create: `kanban/src/components/NovelModal.tsx`

**Step 1: 创建弹窗组件**

```typescript
// kanban/src/components/NovelModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Novel, NovelStatus } from '@/types';
import { GENRE_OPTIONS } from '@/types';
import { generateId } from '@/lib/utils';

interface NovelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (novel: Novel) => void;
  novel?: Novel | null;
  defaultStatus?: NovelStatus;
}

export function NovelModal({ isOpen, onClose, onSave, novel, defaultStatus = 'todo' }: NovelModalProps) {
  const [formData, setFormData] = useState<Partial<Novel>>({
    title: '',
    genre: 'xuanhuan',
    theme: '',
    targetChapters: 100,
    writtenChapters: 0,
    wordCount: 0,
    description: '',
    status: defaultStatus,
  });

  useEffect(() => {
    if (novel) {
      setFormData(novel);
    } else {
      setFormData({
        title: '',
        genre: 'xuanhuan',
        theme: '',
        targetChapters: 100,
        writtenChapters: 0,
        wordCount: 0,
        description: '',
        status: defaultStatus,
      });
    }
  }, [novel, defaultStatus, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;

    const now = new Date().toISOString();
    const newNovel: Novel = {
      id: novel?.id || generateId(),
      title: formData.title!,
      genre: formData.genre!,
      theme: formData.theme || '',
      targetChapters: formData.targetChapters || 100,
      writtenChapters: formData.writtenChapters || 0,
      wordCount: formData.wordCount || 0,
      description: formData.description,
      status: formData.status || defaultStatus,
      createdAt: novel?.createdAt || now,
      updatedAt: now,
    };

    onSave(newNovel);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {novel ? '编辑小说' : '新建小说'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">标题 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                         text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">类型</label>
              <select
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                           text-white focus:outline-none focus:border-blue-500"
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">主题</label>
              <input
                type="text"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                           text-white focus:outline-none focus:border-blue-500"
                placeholder="如：修仙"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">目标章节</label>
              <input
                type="number"
                value={formData.targetChapters}
                onChange={(e) =>
                  setFormData({ ...formData, targetChapters: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                           text-white focus:outline-none focus:border-blue-500"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">已写章节</label>
              <input
                type="number"
                value={formData.writtenChapters}
                onChange={(e) =>
                  setFormData({ ...formData, writtenChapters: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                           text-white focus:outline-none focus:border-blue-500"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">字数</label>
            <input
              type="number"
              value={formData.wordCount}
              onChange={(e) =>
                setFormData({ ...formData, wordCount: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                         text-white focus:outline-none focus:border-blue-500"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">简介</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                         text-white focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: 提交**

```bash
git add kanban/src/components/NovelModal.tsx
git commit -m "feat(kanban): 创建小说编辑弹窗组件"
```

---

## Phase 4: 看板主组件

### Task 10: 创建看板主组件

**Files:**
- Create: `kanban/src/components/KanbanBoard.tsx`

**Step 1: 创建看板主组件**

```typescript
// kanban/src/components/KanbanBoard.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useKanbanStore } from '@/store';
import { STATUS_ORDER, type Novel, type NovelStatus } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { SearchFilter } from './SearchFilter';
import { NovelModal } from './NovelModal';

export function KanbanBoard() {
  const {
    novels,
    searchQuery,
    selectedGenre,
    moveNovel,
    setSearchQuery,
    setSelectedGenre,
    addNovel,
    updateNovel,
    deleteNovel,
  } = useKanbanStore();

  const [activeNovel, setActiveNovel] = useState<Novel | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<NovelStatus>('todo');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // 筛选小说
  const filteredNovels = useMemo(() => {
    return novels.filter((novel) => {
      const matchesSearch = novel.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesGenre = !selectedGenre || novel.genre === selectedGenre;
      return matchesSearch && matchesGenre;
    });
  }, [novels, searchQuery, selectedGenre]);

  // 按状态分组
  const novelsByStatus = useMemo(() => {
    const grouped: Record<NovelStatus, Novel[]> = {
      todo: [],
      writing: [],
      reviewing: [],
      published: [],
    };
    filteredNovels.forEach((novel) => {
      grouped[novel.status].push(novel);
    });
    return grouped;
  }, [filteredNovels]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const novel = novels.find((n) => n.id === active.id);
    if (novel) {
      setActiveNovel(novel);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveNovel(null);

    if (over) {
      const novelId = active.id as string;
      const newStatus = over.id as NovelStatus;

      if (STATUS_ORDER.includes(newStatus)) {
        moveNovel(novelId, newStatus);
      }
    }
  };

  const handleAddNovel = (status: NovelStatus) => {
    setEditingNovel(null);
    setDefaultStatus(status);
    setModalOpen(true);
  };

  const handleEditNovel = (novel: Novel) => {
    setEditingNovel(novel);
    setModalOpen(true);
  };

  const handleDeleteNovel = (novelId: string) => {
    if (confirm('确定要删除这本小说吗？')) {
      deleteNovel(novelId);
    }
  };

  const handleSaveNovel = (novel: Novel) => {
    if (editingNovel) {
      updateNovel(novel);
    } else {
      addNovel(novel);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <SearchFilter
        searchQuery={searchQuery}
        selectedGenre={selectedGenre}
        onSearchChange={setSearchQuery}
        onGenreChange={setSelectedGenre}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
          {STATUS_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              id={status}
              novels={novelsByStatus[status]}
              onAddNovel={handleAddNovel}
              onEditNovel={handleEditNovel}
              onDeleteNovel={handleDeleteNovel}
            />
          ))}
        </div>

        <DragOverlay>
          {activeNovel && (
            <div className="rotate-3">
              <div className="bg-slate-800 rounded-lg p-4 border border-blue-500 shadow-xl">
                <h3 className="font-medium text-white">{activeNovel.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{activeNovel.theme}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <NovelModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveNovel}
        novel={editingNovel}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}
```

**Step 2: 验证编译**

```bash
cd kanban && npx tsc --noEmit
```

**Step 3: 提交**

```bash
git add kanban/src/components/KanbanBoard.tsx
git commit -m "feat(kanban): 创建看板主组件，集成拖拽和状态管理"
```

---

### Task 11: 创建组件导出

**Files:**
- Create: `kanban/src/components/index.ts`

**Step 1: 创建组件导出**

```typescript
// kanban/src/components/index.ts
export { NovelCard } from './NovelCard';
export { KanbanColumn } from './KanbanColumn';
export { KanbanBoard } from './KanbanBoard';
export { SearchFilter } from './SearchFilter';
export { NovelModal } from './NovelModal';
```

**Step 2: 提交**

```bash
git add kanban/src/components/index.ts
git commit -m "feat(kanban): 添加组件统一导出"
```

---

## Phase 5: 页面集成

### Task 12: 更新主页面

**Files:**
- Modify: `kanban/src/app/page.tsx`
- Modify: `kanban/src/app/layout.tsx`

**Step 1: 更新布局文件**

```typescript
// kanban/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小说创作看板",
  description: "AI小说创作进度管理看板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 2: 更新主页面**

```typescript
// kanban/src/app/page.tsx
import { KanbanBoard } from "@/components";

export default function Home() {
  return (
    <main className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">小说创作看板</h1>
        <p className="text-slate-400 mt-1">管理你的 AI 小说创作进度</p>
      </header>
      <KanbanBoard />
    </main>
  );
}
```

**Step 3: 验证应用运行**

```bash
cd kanban && npm run dev
# 访问 http://localhost:3000
# 确认看板正常显示
```

**Step 4: 提交**

```bash
git add kanban/src/app/
git commit -m "feat(kanban): 集成看板到主页面"
```

---

## Phase 6: 测试和优化

### Task 13: 添加示例数据

**Files:**
- Create: `kanban/src/lib/sampleData.ts`

**Step 1: 创建示例数据**

```typescript
// kanban/src/lib/sampleData.ts
import type { Novel } from '@/types';

export const sampleNovels: Novel[] = [
  {
    id: 'novel-1',
    title: '修仙之路',
    genre: 'xuanhuan',
    theme: '修仙',
    targetChapters: 200,
    writtenChapters: 50,
    wordCount: 150000,
    status: 'writing',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-09T15:30:00Z',
    description: '一个普通少年的修仙之旅',
  },
  {
    id: 'novel-2',
    title: '都市精英',
    genre: 'dushi',
    theme: '职场',
    targetChapters: 100,
    writtenChapters: 100,
    wordCount: 300000,
    status: 'published',
    createdAt: '2026-02-15T08:00:00Z',
    updatedAt: '2026-03-05T20:00:00Z',
    description: '都市职场励志故事',
  },
  {
    id: 'novel-3',
    title: '星际迷航',
    genre: 'kehuan',
    theme: '太空探险',
    targetChapters: 150,
    writtenChapters: 30,
    wordCount: 90000,
    status: 'reviewing',
    createdAt: '2026-03-05T12:00:00Z',
    updatedAt: '2026-03-08T18:00:00Z',
  },
  {
    id: 'novel-4',
    title: '缘定三生',
    genre: 'yanqing',
    theme: '古风言情',
    targetChapters: 80,
    writtenChapters: 0,
    wordCount: 0,
    status: 'todo',
    createdAt: '2026-03-09T10:00:00Z',
    updatedAt: '2026-03-09T10:00:00Z',
  },
];
```

**Step 2: 更新 store 添加初始化逻辑**

```typescript
// 在 kanban/src/store/kanbanStore.ts 中添加
import { sampleNovels } from '@/lib/sampleData';

// 在 persist 配置后添加
if (useKanbanStore.getState().novels.length === 0) {
  useKanbanStore.getState().setNovels(sampleNovels);
}
```

**Step 3: 提交**

```bash
git add kanban/src/lib/sampleData.ts kanban/src/store/kanbanStore.ts
git commit -m "feat(kanban): 添加示例数据"
```

---

### Task 14: 最终验证和构建

**Step 1: 运行类型检查**

```bash
cd kanban && npx tsc --noEmit
# 应无错误
```

**Step 2: 运行 ESLint**

```bash
cd kanban && npm run lint
# 修复任何警告
```

**Step 3: 构建生产版本**

```bash
cd kanban && npm run build
# 确认构建成功
```

**Step 4: 最终提交**

```bash
git add kanban/
git commit -m "feat(kanban): 完成小说创作看板系统"
```

---

## 文件结构总览

```
kanban/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── index.ts
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColumn.tsx
│   │   ├── NovelCard.tsx
│   │   ├── NovelModal.tsx
│   │   └── SearchFilter.tsx
│   ├── lib/
│   │   ├── sampleData.ts
│   │   └── utils.ts
│   ├── store/
│   │   ├── index.ts
│   │   └── kanbanStore.ts
│   └── types/
│       └── index.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## 测试清单

- [ ] 拖拽小说卡片到不同列
- [ ] 搜索小说标题
- [ ] 按类型筛选
- [ ] 新建小说
- [ ] 编辑小说
- [ ] 删除小说
- [ ] 刷新页面后数据持久化
- [ ] 响应式布局

