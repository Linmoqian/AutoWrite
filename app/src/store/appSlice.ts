import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  getNovelDir,
  getStatus,
  loadConfig,
  listChapters,
  listImages,
  getImagePath,
  selectNovelDir,
} from "../services/tauri";
import type {
  AppConfig,
  ChapterMeta,
  ImageResult,
  NovelStatus,
} from "../types";

interface AppState {
  novelDir: string | null;
  novelStatus: NovelStatus | null;
  config: AppConfig | null;
  chapters: ChapterMeta[];
  images: ImageResult[];
  loading: boolean;
}

const initialState: AppState = {
  novelDir: null,
  novelStatus: null,
  config: null,
  chapters: [],
  images: [],
  loading: true,
};

export const refreshStatus = createAsyncThunk(
  "app/refreshStatus",
  async () => {
    try {
      return await getStatus();
    } catch {
      return null;
    }
  },
);

export const refreshConfig = createAsyncThunk(
  "app/refreshConfig",
  async () => {
    try {
      return await loadConfig();
    } catch {
      return null;
    }
  },
);

export const refreshChapters = createAsyncThunk(
  "app/refreshChapters",
  async () => {
    try {
      return await listChapters();
    } catch {
      return [];
    }
  },
);

export const refreshImages = createAsyncThunk(
  "app/refreshImages",
  async () => {
    try {
      const list = await listImages();
      return await Promise.all(
        list.map(async (img) => ({
          ...img,
          localPath: await getImagePath(img.localPath),
        })),
      );
    } catch {
      return [];
    }
  },
);

export const refreshAll = createAsyncThunk(
  "app/refreshAll",
  async (_, { dispatch }) => {
    const dir = await getNovelDir().catch(() => null);
    await Promise.all([
      dispatch(refreshStatus()),
      dispatch(refreshConfig()),
      dispatch(refreshChapters()),
      dispatch(refreshImages()),
    ]);
    return dir;
  },
);

export const selectDir = createAsyncThunk(
  "app/selectDir",
  async (_, { dispatch }) => {
    const dir = await selectNovelDir();
    await dispatch(refreshAll());
    return dir;
  },
);

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(refreshStatus.fulfilled, (state, action) => {
        state.novelStatus = action.payload;
      })
      .addCase(refreshConfig.fulfilled, (state, action) => {
        state.config = action.payload;
      })
      .addCase(refreshChapters.fulfilled, (state, action) => {
        state.chapters = action.payload;
      })
      .addCase(refreshImages.fulfilled, (state, action) => {
        state.images = action.payload;
      })
      .addCase(refreshAll.pending, (state) => {
        state.loading = true;
      })
      .addCase(refreshAll.fulfilled, (state, action) => {
        state.novelDir = action.payload;
        state.loading = false;
      })
      .addCase(selectDir.fulfilled, (state, action) => {
        state.novelDir = action.payload;
      });
  },
});

export default appSlice.reducer;
