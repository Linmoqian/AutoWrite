import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNovelStore } from "@/stores/novel-store";
import { useConnectionCheck } from "@/hooks/use-connection-check";
import { generateChapter, onChapterProgress } from "@/services/tauri";
import { filterThinkTags } from "@/lib/filter-think-tags";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChapterCard } from "@/components/common/ChapterCard";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Chapters() {
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
      const current = useNovelStore.getState().streamingText;
      setStreamingText(current + chunk);
    }
    flushTimerRef.current = window.setTimeout(flushBuffer, 80);
  }, [setStreamingText]);

  useEffect(() => {
    refreshChapters();
    return () => clearTimeout(flushTimerRef.current);
  }, [refreshChapters]);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledRef.current = !atBottom;
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
    setLoadingChapterState(true);
    try {
      await selectChapter(filename);
      setViewingDuringGen(isGenerating);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoadingChapterState(false);
    }
  };

  const handleGenerate = async () => {
    if (!(await checkConnection())) return;
    const num = chapters.length > 0 ? chapters[chapters.length - 1].number + 1 : 1;
    startGeneration(num);
    bufferRef.current = "";
    userScrolledRef.current = false;
    setViewingDuringGen(false);
    flushTimerRef.current = window.setTimeout(flushBuffer, 80);

    const unlisten = await onChapterProgress((e) => {
      if (e.chunk) bufferRef.current += e.chunk;
    });

    try {
      await generateChapter();
      clearTimeout(flushTimerRef.current);
      flushBuffer();
      finishGeneration();
      toast.success(`第 ${num} 章已生成`);
      refreshChapters();
    } catch (e) {
      clearTimeout(flushTimerRef.current);
      setError(String(e));
      toast.error(`生成失败: ${e}`);
    } finally {
      unlisten();
    }
  };

  if (chapters.length === 0 && !isGenerating) {
    return (
      <div className="fade-in">
        <h1 className="page-title">章节管理</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <p className="text-muted-foreground">
              暂无章节，请先在「大纲管理」页面生成大纲
            </p>
            <Button onClick={handleGenerate}>
              <FileText className="mr-1.5 h-4 w-4" />
              写第一章
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayText = filterThinkTags(streamingText);
  const generatingMeta = isGenerating
    ? { filename: "", number: generatingChapter ?? chapters.length + 1, title: "创作中...", wordCount: 0, createdAt: "" }
    : null;

  return (
    <div className="fade-in flex h-full flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h1 className="page-title mb-0 pb-0">章节管理</h1>
        <Button onClick={handleGenerate} loading={isGenerating}>
          <FileText className="mr-1.5 h-4 w-4" />
          写下一章
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Chapter list */}
        <Card className="w-[220px] shrink-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-0.5 p-2">
              {chapters.map((ch) => (
                <ChapterCard
                  key={ch.filename}
                  chapter={ch}
                  selected={!isGenerating && selected?.meta.number === ch.number}
                  onClick={() => handleSelect(ch.filename, ch.number)}
                />
              ))}
              {generatingMeta && (
                <ChapterCard
                  chapter={generatingMeta}
                  selected={!viewingDuringGen}
                  generating
                  onClick={() => {
                    setViewingDuringGen(false);
                    clearSelection();
                  }}
                />
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Reading / streaming view */}
        <Card className="min-w-0 flex-1 overflow-hidden">
          <ReadingView
            isGenerating={isGenerating}
            viewingDuringGen={viewingDuringGen}
            loadingChapter={loadingChapter}
            displayText={displayText}
            streamRef={streamRef}
            selected={selected}
          />
        </Card>
      </div>
    </div>
  );
}

function ReadingView({
  isGenerating,
  viewingDuringGen,
  loadingChapter,
  displayText,
  streamRef,
  selected,
}: {
  isGenerating: boolean;
  viewingDuringGen: boolean;
  loadingChapter: boolean;
  displayText: string;
  streamRef: React.RefObject<HTMLDivElement | null>;
  selected: ReturnType<typeof useNovelStore.getState>["selectedChapter"];
}) {
  if (isGenerating && !viewingDuringGen) {
    return displayText ? (
      <div ref={streamRef} className="h-full overflow-y-auto p-5">
        <div className="md-body">
          <Markdown remarkPlugins={[remarkGfm]}>{displayText}</Markdown>
          <span className="cursor-blink">|</span>
        </div>
      </div>
    ) : (
      <div className="flex h-full items-center justify-center p-6">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在连接模型...
        </span>
      </div>
    );
  }

  if (loadingChapter) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </span>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="h-full overflow-y-auto p-5">
        <div className="font-serif text-xl text-foreground">
          第{selected.meta.number}章 {selected.meta.title}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {selected.meta.wordCount.toLocaleString()} 字 | {selected.meta.createdAt}
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <div className="chapter-content">
            <Markdown remarkPlugins={[remarkGfm]}>
              {filterThinkTags(selected.body)}
            </Markdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
      选择左侧章节查看内容
    </div>
  );
}
