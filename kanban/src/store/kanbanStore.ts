import { create } from 'zustand';
import type { KanbanState, Chapter, Character, Novel, WorkflowStatus } from '@/types';
import { novelApi, chapterApi, characterApi } from '@/lib/api';

export const useKanbanStore = create<KanbanState>()((set, get) => ({
  novels: [],
  chapters: [],
  characters: [],
  searchQuery: '',
  selectedGenre: null,

  // 加载数据
  loadNovels: async () => {
    try {
      const { novels } = await novelApi.list();
      set({ novels: novels as unknown as Novel[] });
    } catch (error) {
      console.error('加载小说列表失败:', error);
    }
  },

  loadChapters: async (novelId: string) => {
    try {
      const chapters = await chapterApi.list(novelId);
      // 合并到现有章节列表中，避免覆盖其他小说的章节
      set((state) => {
        const otherChapters = state.chapters.filter((c) => c.novelId !== novelId);
        return { chapters: [...otherChapters, ...chapters] as unknown as Chapter[] };
      });
    } catch (error) {
      console.error('加载章节列表失败:', error);
    }
  },

  loadCharacters: async (novelId: string) => {
    try {
      const characters = await characterApi.list(novelId);
      // 合并到现有角色列表中，避免覆盖其他小说的角色
      set((state) => {
        const otherCharacters = state.characters.filter((c) => c.novelId !== novelId);
        return { characters: [...otherCharacters, ...characters] as unknown as Character[] };
      });
    } catch (error) {
      console.error('加载角色列表失败:', error);
    }
  },

  setNovels: (novels) => set({ novels }),

  moveNovel: async (novelId, newStatus) => {
    const novel = get().novels.find((n) => n.id === novelId);
    if (!novel) return;

    // 乐观更新 UI
    set((state) => ({
      novels: state.novels.map((n) =>
        n.id === novelId
          ? { ...n, status: newStatus, updatedAt: new Date().toISOString() }
          : n
      ),
    }));

    // 同步到 API
    try {
      await novelApi.update(novelId, { status: newStatus });
    } catch (error) {
      console.error('更新小说状态失败:', error);
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedGenre: (genre) => set({ selectedGenre: genre }),

  addNovel: async (novel) => {
    try {
      const created = await novelApi.create({
        title: novel.title,
        genre: novel.genre,
        theme: novel.theme,
        targetChapters: novel.targetChapters,
        description: novel.description,
      });
      set((state) => ({ novels: [...state.novels, created as unknown as Novel] }));
    } catch (error) {
      console.error('创建小说失败:', error);
    }
  },

  updateNovel: async (novel) => {
    set((state) => ({
      novels: state.novels.map((n) => (n.id === novel.id ? novel : n)),
    }));
    try {
      await novelApi.update(novel.id, {
        title: novel.title,
        genre: novel.genre,
        theme: novel.theme,
        targetChapters: novel.targetChapters,
        writtenChapters: novel.writtenChapters,
        wordCount: novel.wordCount,
        description: novel.description,
      });
    } catch (error) {
      console.error('更新小说失败:', error);
    }
  },

  deleteNovel: async (novelId) => {
    set((state) => ({
      novels: state.novels.filter((n) => n.id !== novelId),
    }));
    try {
      await novelApi.delete(novelId);
    } catch (error) {
      console.error('删除小说失败:', error);
    }
  },

  // 章节管理
  addChapter: async (chapter: Chapter) => {
    try {
      const created = await chapterApi.create(chapter.novelId, {
        number: chapter.number,
        title: chapter.title,
        content: chapter.content,
        status: chapter.status,
      });
      set((state) => ({ chapters: [...state.chapters, created as unknown as Chapter] }));
    } catch (error) {
      console.error('创建章节失败:', error);
    }
  },

  updateChapter: async (chapter: Chapter) => {
    set((state) => ({
      chapters: state.chapters.map((c) => (c.id === chapter.id ? chapter : c)),
    }));
    try {
      await chapterApi.update(chapter.novelId, chapter.id, {
        title: chapter.title,
        content: chapter.content,
        status: chapter.status,
      });
    } catch (error) {
      console.error('更新章节失败:', error);
    }
  },

  deleteChapter: async (chapterId: string) => {
    const chapter = get().chapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    set((state) => ({
      chapters: state.chapters.filter((c) => c.id !== chapterId),
    }));
    try {
      await chapterApi.delete(chapter.novelId, chapterId);
    } catch (error) {
      console.error('删除章节失败:', error);
    }
  },

  getChaptersByNovelId: (novelId: string) => {
    return get().chapters.filter((c) => c.novelId === novelId);
  },

  // 角色管理
  addCharacter: async (character: Character) => {
    try {
      const created = await characterApi.create(character.novelId, {
        name: character.name,
        role: character.role,
        description: character.description,
        traits: character.traits,
      });
      set((state) => ({ characters: [...state.characters, created as unknown as Character] }));
    } catch (error) {
      console.error('创建角色失败:', error);
    }
  },

  updateCharacter: async (character: Character) => {
    set((state) => ({
      characters: state.characters.map((c) =>
        c.id === character.id ? character : c
      ),
    }));
    try {
      await characterApi.update(character.novelId, character.id, {
        name: character.name,
        role: character.role,
        description: character.description,
        traits: character.traits,
      });
    } catch (error) {
      console.error('更新角色失败:', error);
    }
  },

  deleteCharacter: async (characterId: string) => {
    const character = get().characters.find((c) => c.id === characterId);
    if (!character) return;

    set((state) => ({
      characters: state.characters.filter((c) => c.id !== characterId),
    }));
    try {
      await characterApi.delete(character.novelId, characterId);
    } catch (error) {
      console.error('删除角色失败:', error);
    }
  },

  getCharactersByNovelId: (novelId: string) => {
    return get().characters.filter((c) => c.novelId === novelId);
  },

  // 小说扩展方法
  updateNovelWorkflowStatus: async (novelId: string, status: WorkflowStatus) => {
    set((state) => ({
      novels: state.novels.map((n) =>
        n.id === novelId
          ? { ...n, workflowStatus: status, updatedAt: new Date().toISOString() }
          : n
      ),
    }));
    try {
      await novelApi.update(novelId, { workflowStatus: status });
    } catch (error) {
      console.error('更新工作流状态失败:', error);
    }
  },

  updateNovelOutline: async (novelId: string, outline: string) => {
    set((state) => ({
      novels: state.novels.map((n) =>
        n.id === novelId
          ? { ...n, outline, updatedAt: new Date().toISOString() }
          : n
      ),
    }));
    try {
      await novelApi.update(novelId, { outline });
    } catch (error) {
      console.error('更新大纲失败:', error);
    }
  },
}));
