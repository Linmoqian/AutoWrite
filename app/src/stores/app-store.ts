import { create } from "zustand";
import {
  getNovelDir,
  getStatus,
  selectNovelDir,
} from "@/services/tauri";
import type { NovelStatus } from "@/types";

interface AppState {
  novelDir: string | null;
  novelStatus: NovelStatus | null;
  loading: boolean;
  setNovelDir: (dir: string | null) => void;
  setNovelStatus: (status: NovelStatus | null) => void;
  refreshNovelDir: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  selectDir: () => Promise<void>;
}

export const useAppStore = create<AppState>()((set) => ({
  novelDir: null,
  novelStatus: null,
  loading: true,

  setNovelDir: (dir) => set({ novelDir: dir }),
  setNovelStatus: (status) => set({ novelStatus: status }),

  refreshNovelDir: async () => {
    try {
      const dir = await getNovelDir();
      set({ novelDir: dir });
    } catch {
      set({ novelDir: null });
    }
  },

  refreshStatus: async () => {
    try {
      const status = await getStatus();
      set({ novelStatus: status });
    } catch {
      set({ novelStatus: null });
    }
  },

  selectDir: async () => {
    const dir = await selectNovelDir();
    set({ novelDir: dir });
  },
}));
