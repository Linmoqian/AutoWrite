import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KanbanState, Chapter, Character } from '@/types';

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set, get) => ({
      novels: [],
      chapters: [],
      characters: [],
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

      // 章节管理
      addChapter: (chapter: Chapter) =>
        set((state) => ({ chapters: [...state.chapters, chapter] })),

      updateChapter: (chapter: Chapter) =>
        set((state) => ({
          chapters: state.chapters.map((c) => (c.id === chapter.id ? chapter : c)),
        })),

      deleteChapter: (chapterId: string) =>
        set((state) => ({
          chapters: state.chapters.filter((c) => c.id !== chapterId),
        })),

      getChaptersByNovelId: (novelId: string) => {
        return get().chapters.filter((c) => c.novelId === novelId);
      },

      // 角色管理
      addCharacter: (character: Character) =>
        set((state) => ({ characters: [...state.characters, character] })),

      updateCharacter: (character: Character) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === character.id ? character : c
          ),
        })),

      deleteCharacter: (characterId: string) =>
        set((state) => ({
          characters: state.characters.filter((c) => c.id !== characterId),
        })),

      getCharactersByNovelId: (novelId: string) => {
        return get().characters.filter((c) => c.novelId === novelId);
      },

      // 小说扩展方法
      updateNovelWorkflowStatus: (novelId: string, status) =>
        set((state) => ({
          novels: state.novels.map((n) =>
            n.id === novelId
              ? { ...n, workflowStatus: status, updatedAt: new Date().toISOString() }
              : n
          ),
        })),

      updateNovelOutline: (novelId: string, outline: string) =>
        set((state) => ({
          novels: state.novels.map((n) =>
            n.id === novelId
              ? { ...n, outline, updatedAt: new Date().toISOString() }
              : n
          ),
        })),
    }),
    { name: 'kanban-storage' }
  )
);
