import { create } from "zustand";
import { listChapters, readChapter } from "@/services/tauri";
import type { ChapterContent, ChapterMeta } from "@/types";

interface NovelState {
  chapters: ChapterMeta[];
  selectedChapter: ChapterContent | null;
  streamingText: string;
  isGenerating: boolean;
  generatingChapter: number | null;
  error: string | null;

  setChapters: (chapters: ChapterMeta[]) => void;
  refreshChapters: () => Promise<void>;
  selectChapter: (filename: string) => Promise<void>;
  clearSelection: () => void;

  startGeneration: (chapterNum: number) => void;
  appendStreamChunk: (chunk: string) => void;
  setStreamingText: (text: string) => void;
  finishGeneration: () => void;
  setError: (error: string | null) => void;
}

export const useNovelStore = create<NovelState>()((set) => ({
  chapters: [],
  selectedChapter: null,
  streamingText: "",
  isGenerating: false,
  generatingChapter: null,
  error: null,

  setChapters: (chapters) => set({ chapters }),

  refreshChapters: async () => {
    try {
      const list = await listChapters();
      set({ chapters: list });
    } catch {
      set({ chapters: [] });
    }
  },

  selectChapter: async (filename: string) => {
    try {
      const content = await readChapter(filename);
      set({ selectedChapter: content });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearSelection: () => set({ selectedChapter: null }),

  startGeneration: (chapterNum: number) =>
    set({
      isGenerating: true,
      generatingChapter: chapterNum,
      streamingText: "",
      error: null,
      selectedChapter: null,
    }),

  appendStreamChunk: (chunk: string) =>
    set((state) => ({ streamingText: state.streamingText + chunk })),

  setStreamingText: (text: string) => set({ streamingText: text }),

  finishGeneration: () =>
    set({
      isGenerating: false,
      generatingChapter: null,
      streamingText: "",
    }),

  setError: (error) => set({ error, isGenerating: false }),
}));
