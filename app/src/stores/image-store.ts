import { create } from "zustand";
import { listImages, getImagePath } from "@/services/tauri";
import type { ImageResult } from "@/types";

interface ImageState {
  images: ImageResult[];
  isGenerating: boolean;
  progress: string;

  setImages: (images: ImageResult[]) => void;
  setGenerating: (generating: boolean) => void;
  setProgress: (progress: string) => void;
  refreshImages: () => Promise<void>;
}

export const useImageStore = create<ImageState>()((set) => ({
  images: [],
  isGenerating: false,
  progress: "",

  setImages: (images) => set({ images }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setProgress: (progress) => set({ progress }),

  refreshImages: async () => {
    try {
      const list = await listImages();
      const withPaths = await Promise.all(
        list.map(async (img) => ({
          ...img,
          filename: await getImagePath(img.filename),
        })),
      );
      set({ images: withPaths });
    } catch {
      set({ images: [] });
    }
  },
}));
