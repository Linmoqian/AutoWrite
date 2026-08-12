import { useEffect, useMemo, useState } from "react";
import { Images, CheckCircle2, Loader2, Clock, XCircle } from "lucide-react";
import { useNovelStore } from "@/stores/novel-store";
import { useImageStore } from "@/stores/image-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useBatchImageGeneration } from "../hooks/use-batch-image-generation";
import type {
  BatchChapterStatus,
  BatchChapterStatusKind,
  BatchImageProgress,
  ChapterMeta,
} from "@/types";

const STATUS_ICON: Record<BatchChapterStatusKind, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  failed: <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

const STATUS_LABEL: Record<BatchChapterStatusKind, string> = {
  pending: "等待中",
  running: "生成中",
  done: "完成",
  failed: "失败",
};

export function BatchImagePanel() {
  const chapters = useNovelStore((s) => s.chapters);
  const refreshChapters = useNovelStore((s) => s.refreshChapters);
  const refreshImages = useImageStore((s) => s.refreshImages);
  const { phase, progress, start, reset } = useBatchImageGeneration();

  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    refreshChapters();
  }, [refreshChapters]);

  const selectedSorted = useMemo(
    () => Array.from(selected).sort((a, b) => a - b),
    [selected],
  );

  const running = phase === "running";
  const toggleChapter = (num: number) => {
    if (running) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Images className="h-4 w-4" />
          批量生成场景插图
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChapterMultiSelect
          chapters={chapters}
          selected={selected}
          running={running}
          onToggle={toggleChapter}
          onSelectAll={() => setSelected(new Set(chapters.map((c) => c.number)))}
          onClearAll={() => setSelected(new Set())}
        />

        {progress && (
          <BatchProgressView
            progress={progress}
            completed={progress.completed}
            failed={progress.failed}
            total={progress.total}
          />
        )}

        <div className="flex gap-2">
          {phase === "done" ? (
            <Button onClick={reset} className="flex-1">
              重新选择
            </Button>
          ) : (
            <Button
              onClick={() => start(selectedSorted, refreshImages)}
              loading={running}
              disabled={running || selectedSorted.length === 0}
              className="flex-1"
            >
              {running
                ? "生成中..."
                : `开始批量生成${selectedSorted.length > 0 ? `（${selectedSorted.length} 章）` : ""}`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ChapterMultiSelect({
  chapters,
  selected,
  running,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  chapters: ChapterMeta[];
  selected: Set<number>;
  running: boolean;
  onToggle: (num: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          选择章节（{chapters.length} 章可选）
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={running || chapters.length === 0}
            className="text-xs text-primary hover:underline disabled:opacity-40"
          >
            全选
          </button>
          <span className="text-xs text-muted-foreground">|</span>
          <button
            type="button"
            onClick={onClearAll}
            disabled={running || selected.size === 0}
            className="text-xs text-muted-foreground hover:underline disabled:opacity-40"
          >
            清空
          </button>
        </div>
      </div>
      {chapters.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          暂无已写章节，请先生成章节正文。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {chapters.map((ch) => (
            <label
              key={ch.filename}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
                selected.has(ch.number)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/5",
                running && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(ch.number)}
                onChange={() => onToggle(ch.number)}
                disabled={running}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span className="truncate text-foreground">
                第{ch.number}章 {ch.title}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function BatchProgressView({
  progress,
  completed,
  failed,
  total,
}: {
  progress: BatchImageProgress;
  completed: number;
  failed: number;
  total: number;
}) {
  const percent =
    total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          进度：{completed} / {total} 完成
          {failed > 0 && (
            <span className="text-destructive">（失败 {failed}）</span>
          )}
        </span>
        <span className="font-medium text-foreground">{percent}%</span>
      </div>
      <Progress value={percent} className="h-2" />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {progress.chapters
          .slice()
          .sort((a, b) => a.chapter - b.chapter)
          .map((c) => (
            <ChapterStatusRow key={c.chapter} status={c} />
          ))}
      </div>
    </div>
  );
}

function ChapterStatusRow({ status }: { status: BatchChapterStatus }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {STATUS_ICON[status.status]}
      <span className="shrink-0 font-medium text-foreground">
        第{status.chapter}章
      </span>
      <span className="text-muted-foreground">
        {status.message || STATUS_LABEL[status.status]}
      </span>
    </div>
  );
}
