import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useConnectionCheck } from "@/hooks/use-connection-check";
import { onImageProgress } from "@/services/tauri";
import type { ImageProgressEvent } from "@/types";

const STAGE_LABELS: Record<ImageProgressEvent["stage"], string> = {
  preparing: "准备中...",
  submitting: "提交任务中...",
  polling: "生成中...",
  downloading: "下载中...",
  saving: "保存中...",
  done: "完成",
};

export function useImageProgress() {
  const [progress, setProgress] = useState("");
  const [loading, setLoading] = useState(false);
  const { checkConnection } = useConnectionCheck();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = async (
    fn: () => Promise<unknown>,
    label: string,
  ): Promise<boolean> => {
    if (!(await checkConnection())) return false;
    setLoading(true);
    setProgress(`准备${label}...`);
    const unlisten = await onImageProgress((e: ImageProgressEvent) => {
      setProgress(e.message || STAGE_LABELS[e.stage]);
    });
    try {
      await fn();
      toast.success(`${label}完成`);
      return true;
    } catch (e) {
      toast.error(String(e));
      return false;
    } finally {
      unlisten();
      if (mountedRef.current) {
        setLoading(false);
        setProgress("");
      }
    }
  };

  return { progress, loading, run };
}
