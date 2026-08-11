import { FileText, Loader2 } from "lucide-react";
import type { ChapterMeta } from "@/types";
import { cn } from "@/lib/utils";

interface ChapterCardProps {
  chapter: ChapterMeta;
  selected: boolean;
  generating?: boolean;
  onClick: () => void;
}

export function ChapterCard({
  chapter,
  selected,
  generating,
  onClick,
}: ChapterCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition-colors",
        selected
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-muted"
      )}
    >
      {generating ? (
        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      ) : (
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {String(chapter.number).padStart(3, "0")}
          </span>
          <span className="truncate text-sm">
            {generating ? "创作中..." : chapter.title}
          </span>
        </div>
        {!generating && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {chapter.wordCount.toLocaleString()} 字
          </div>
        )}
      </div>
    </button>
  );
}
