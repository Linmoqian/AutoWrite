import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useNovelStore } from "@/stores/novel-store";
import { useConnectionCheck } from "@/hooks/use-connection-check";
import { generateChapter, onChapterProgress } from "@/services/tauri";
import { filterThinkTags } from "@/lib/filter-think-tags";

const FLUSH_INTERVAL_MS = 80;

export function useChapters() {
  const chapters = useNovelStore((s) => s.chapters);
  const selected = useNovelStore((s) => s.selectedChapter);
  const streamingText = useNovelStore((s) => s.streamingText);
  const isGenerating = useNovelStore((s) => s.isGenerating);
  const generatingChapter = useNovelStore((s) => s.generatingChapter);
  const refreshChapters = useNovelStore((s) => s.refreshChapters);
  const selectChapter = useNovelStore((s) => s.selectChapter);
  const startGeneration = useNovelStore((s) => s.startGeneration);
  const setStreamingText = useNovelStore((s) => s.setStreamingText);
  const finishGeneration = useNovelStore((s) => s.finishGeneration);
  const setError = useNovelStore((s) => s.setError);
  const clearSelection = useNovelStore((s) => s.clearSelection);
  const { checkConnection } = useConnectionCheck();

  const [viewingDuringGen, setViewingDuringGen] = useState(false);
  const [loadingChapter, setLoadingChapterState] = useState(false);
  const bufferRef = useRef("");
  const flushTimerRef = useRef(0);
  const streamRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const flushBuffer = useCallback(() => {
    if (bufferRef.current) {
      const chunk = bufferRef.current;
      bufferRef.current = "";
      setStreamingText(useNovelStore.getState().streamingText + chunk);
    }
    flushTimerRef.current = window.setTimeout(flushBuffer, FLUSH_INTERVAL_MS);
  }, [setStreamingText]);

  useEffect(() => {
    refreshChapters();
    return () => clearTimeout(flushTimerRef.current);
  }, [refreshChapters]);

  // 自动跟随滚动：用户手动上滑后停止跟随
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const onScroll = () => {
      userScrolledRef.current = !(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [isGenerating]);

  useEffect(() => {
    if (streamRef.current && !viewingDuringGen && !userScrolledRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingText, viewingDuringGen]);

  const handleSelect = async (filename: string, number: number) => {
    if (isGenerating && number === generatingChapter) {
      setViewingDuringGen(false);
      return;
    }
    await loadChapter(filename, selectChapter, isGenerating, setLoadingChapterState, setViewingDuringGen);
  };

  const handleGenerate = async () => {
    if (!(await checkConnection())) return;
    await runGeneration({ chapters, startGeneration, flushBuffer, setViewingDuringGen, bufferRef, userScrolledRef, flushTimerRef, finishGeneration, refreshChapters, setError });
  };

  const handleViewGenerating = () => {
    setViewingDuringGen(false);
    clearSelection();
  };

  const displayText = filterThinkTags(streamingText);
  const generatingMeta = isGenerating
    ? { filename: "", number: generatingChapter ?? chapters.length + 1, title: "创作中...", wordCount: 0, createdAt: "" }
    : null;

  return {
    chapters, selected, isGenerating, generatingChapter, generatingMeta,
    displayText, viewingDuringGen, loadingChapter, handleSelect,
    handleGenerate, handleViewGenerating, streamRef,
  };
}

async function loadChapter(
  filename: string,
  selectChapter: (f: string) => Promise<void>,
  isGenerating: boolean,
  setLoading: (b: boolean) => void,
  setViewingDuringGen: (b: boolean) => void,
) {
  setLoading(true);
  try {
    await selectChapter(filename);
    setViewingDuringGen(isGenerating);
  } catch (e) {
    toast.error(String(e));
  } finally {
    setLoading(false);
  }
}

interface GenerationDeps {
  chapters: { number: number }[];
  startGeneration: (n: number) => void;
  flushBuffer: () => void;
  setViewingDuringGen: (b: boolean) => void;
  bufferRef: React.RefObject<string>;
  userScrolledRef: React.RefObject<boolean>;
  flushTimerRef: React.RefObject<number>;
  finishGeneration: () => void;
  refreshChapters: () => Promise<void>;
  setError: (e: string) => void;
}

async function runGeneration(d: GenerationDeps) {
  const num = d.chapters.length > 0 ? d.chapters[d.chapters.length - 1].number + 1 : 1;
  d.startGeneration(num);
  d.bufferRef.current = "";
  d.userScrolledRef.current = false;
  d.setViewingDuringGen(false);
  d.flushTimerRef.current = window.setTimeout(d.flushBuffer, FLUSH_INTERVAL_MS);

  const unlisten = await onChapterProgress((e) => {
    if (e.chunk) d.bufferRef.current += e.chunk;
  });

  try {
    await generateChapter();
    clearTimeout(d.flushTimerRef.current);
    d.flushBuffer();
    d.finishGeneration();
    toast.success(`第 ${num} 章已生成`);
    await d.refreshChapters();
  } catch (e) {
    clearTimeout(d.flushTimerRef.current);
    d.setError(String(e));
    toast.error(`生成失败: ${e}`);
  } finally {
    unlisten();
  }
}
