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
    { name: 'kanban-storage' }
  )
);
