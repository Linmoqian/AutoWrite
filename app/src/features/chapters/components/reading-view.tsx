import { Loader2 } from "lucide-react";
import { filterThinkTags } from "@/lib/filter-think-tags";
import { useNovelStore } from "@/stores/novel-store";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ReadingView({
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
