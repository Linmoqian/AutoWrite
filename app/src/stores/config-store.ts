import { create } from "zustand";
import { loadConfig, saveConfig } from "@/services/tauri";
import type { AppConfig } from "@/types";

interface ConfigState {
  config: AppConfig | null;
  loading: boolean;
  saved: boolean;

  setConfig: (config: AppConfig | null) => void;
  refreshConfig: () => Promise<void>;
  saveConfigAction: (config: AppConfig) => Promise<boolean>;
}

export const useConfigStore = create<ConfigState>()((set) => ({
  config: null,
  loading: true,
  saved: false,

  setConfig: (config) => set({ config }),

  refreshConfig: async () => {
    set({ loading: true });
    try {
      const config = await loadConfig();
      set({ config, loading: false });
    } catch {
      set({ config: null, loading: false });
    }
  },

  saveConfigAction: async (config: AppConfig) => {
    try {
      await saveConfig(config);
      set({ config, saved: true });
      setTimeout(() => set({ saved: false }), 3000);
      return true;
    } catch {
      set({ saved: false });
      return false;
    }
  },
}));
