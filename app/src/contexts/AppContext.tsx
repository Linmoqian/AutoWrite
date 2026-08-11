import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  getNovelDir,
  getStatus,
  loadConfig,
  listChapters,
  listImages,
  getImagePath,
  selectNovelDir as tauriSelectDir,
} from "../services/tauri";
import type {
  AppConfig,
  ChapterMeta,
  ImageResult,
  NovelStatus,
} from "../types";

interface AppContextType {
  novelDir: string | null;
  novelStatus: NovelStatus | null;
  config: AppConfig | null;
  chapters: ChapterMeta[];
  images: ImageResult[];
  loading: boolean;

  refreshAll: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  refreshChapters: () => Promise<void>;
  refreshImages: () => Promise<void>;
  selectDir: () => Promise<string>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [novelDir, setNovelDir] = useState<string | null>(null);
  const [novelStatus, setNovelStatus] = useState<NovelStatus | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    refreshAll();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getStatus();
      if (mountedRef.current) setNovelStatus(s);
    } catch {
      if (mountedRef.current) setNovelStatus(null);
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const c = await loadConfig();
      if (mountedRef.current) setConfig(c);
    } catch {
      if (mountedRef.current) setConfig(null);
    }
  }, []);

  const refreshChapters = useCallback(async () => {
    try {
      const list = await listChapters();
      if (mountedRef.current) setChapters(list);
    } catch {
      if (mountedRef.current) setChapters([]);
    }
  }, []);

  const refreshImages = useCallback(async () => {
    try {
      const list = await listImages();
      const hydrated = await Promise.all(
        list.map(async (img) => ({
          ...img,
          localPath: await getImagePath(img.localPath),
        })),
      );
      if (mountedRef.current) setImages(hydrated);
    } catch {
      if (mountedRef.current) setImages([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      tauriSelectDir !== null
        ? getNovelDir().then((d) => {
            if (mountedRef.current) setNovelDir(d);
          })
        : Promise.resolve(),
      refreshStatus(),
      refreshConfig(),
      refreshChapters(),
      refreshImages(),
    ]);
    if (mountedRef.current) setLoading(false);
  }, [refreshStatus, refreshConfig, refreshChapters, refreshImages]);

  const selectDir = useCallback(async () => {
    const dir = await tauriSelectDir();
    setNovelDir(dir);
    await refreshAll();
    return dir;
  }, [refreshAll]);

  return (
    <AppContext.Provider
      value={{
        novelDir,
        novelStatus,
        config,
        chapters,
        images,
        loading,
        refreshAll,
        refreshStatus,
        refreshConfig,
        refreshChapters,
        refreshImages,
        selectDir,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
