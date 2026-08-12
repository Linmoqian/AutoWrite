import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  generateSceneImagesBatch,
  onBatchImageProgress,
} from "@/services/tauri";
import { useConnectionCheck } from "@/hooks/use-connection-check";
import type {
  BatchChapterStatusKind,
  BatchImageProgress,
} from "@/types";

type Phase = "idle" | "running" | "done";

/**
 * 批量场景插图生成状态管理 hook。
 * 封装：连接检测、事件订阅、进度状态、错误提示。
 *
 * 注意：用 progressRef 跟踪最新进度，避免 await 期间闭包捕获旧 state
 * 导致 failCount 恒为 0 的 bug。
 */
export function useBatchImageGeneration() {
  const { checkConnection } = useConnectionCheck();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<BatchImageProgress | null>(null);
  const progressRef = useRef<BatchImageProgress | null>(null);

  const start = async (chapterNums: number[], onDone?: () => void) => {
    if (chapterNums.length === 0) {
      toast.warning("请至少选择一个章节");
      return;
    }
    if (!(await checkConnection())) return;

    setPhase("running");
    const initial = buildInitialProgress(chapterNums);
    progressRef.current = initial;
    setProgress(initial);

    const unlisten = await onBatchImageProgress((e) => {
      progressRef.current = e;
      setProgress(e);
    });
    try {
      const results = await generateSceneImagesBatch(chapterNums);
      const failCount = progressRef.current?.failed ?? 0;
      if (results.length > 0) {
        toast.success(
          `批量生成完成，成功 ${results.length} 张${failCount > 0 ? `，失败 ${failCount} 张` : ""}`,
        );
      } else {
        toast.error("批量生成失败，没有成功的图片");
      }
      onDone?.();
    } catch (e) {
      toast.error(`批量生成出错: ${e}`);
    } finally {
      unlisten();
      setPhase("done");
    }
  };

  const reset = () => {
    setPhase("idle");
    setProgress(null);
    progressRef.current = null;
  };

  return { phase, progress, start, reset };
}

function buildInitialProgress(
  chapterNums: number[],
): BatchImageProgress {
  return {
    total: chapterNums.length,
    completed: 0,
    failed: 0,
    currentChapter: null,
    currentMessage: null,
    chapters: chapterNums.map((n) => ({
      chapter: n,
      status: "pending" as BatchChapterStatusKind,
      message: null,
    })),
  };
}
