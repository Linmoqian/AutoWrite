import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { useConnectionCheck } from "@/hooks/use-connection-check";
import {
  getOutlineGenerationStatus,
  startOutlineGeneration,
  onOutlineProgress,
  onOutlineGenerationStatus,
} from "@/services/tauri";
import { OUTLINE_STEPS } from "@/lib/constants";
import type { OutlineStep, OutlineProgressEvent, OutlineGenerationStatus } from "@/types";

type StreamingText = Partial<Record<OutlineStep, string>>;
type Volume = { title: string; chapters: { number: number; title: string; summary: string }[] };

export interface UseOutlineResult {
  loading: boolean;
  currentStep: OutlineStep | null;
  streamingText: StreamingText;
  viewTab: OutlineStep;
  setViewTab: (step: OutlineStep) => void;
  availableSteps: readonly OutlineStep[];
  activeTab: OutlineStep;
  handleGenerate: () => Promise<void>;
  streamRef: React.RefObject<HTMLDivElement | null>;
}

export function useOutline(
  world: string | undefined,
  characters: string | undefined,
  volumes: Volume[],
): UseOutlineResult {
  const refreshStatus = useAppStore((s) => s.refreshStatus);
  const { checkConnection } = useConnectionCheck();

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<OutlineStep | null>(null);
  const [streamingText, setStreamingText] = useState<StreamingText>({});
  const [viewTab, setViewTab] = useState<OutlineStep>("worldView");
  const streamRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const wasRunningRef = useRef(false);

  const applyStatus = useCallback(
    (st: OutlineGenerationStatus) => {
      setLoading(st.running);
      setCurrentStep(st.currentStep ?? null);
      setStreamingText(st.streamingText ?? {});
      if (wasRunningRef.current && !st.running) {
        if (st.completed) {
          toast.success("大纲生成完成");
          refreshStatus();
        } else if (st.error) {
          toast.error(`生成失败: ${st.error}`);
        }
      }
      wasRunningRef.current = st.running;
    },
    [refreshStatus],
  );

  const syncStatus = useCallback(async () => {
    try {
      applyStatus(await getOutlineGenerationStatus());
    } catch (e) {
      toast.error(String(e));
    }
  }, [applyStatus]);

  useEffect(() => {
    refreshStatus();
    syncStatus();
  }, [refreshStatus, syncStatus]);

  // 流式进度 + 状态事件
  useEffect(() => {
    const p = onOutlineProgress((e: OutlineProgressEvent) => {
      setLoading(true);
      setCurrentStep(e.step);
      if (e.chunk) {
        setStreamingText((prev) => ({ ...prev, [e.step]: (prev[e.step] || "") + e.chunk }));
      }
    });
    const s = onOutlineGenerationStatus(applyStatus);
    return () => {
      p.then((un) => un());
      s.then((un) => un());
    };
  }, [applyStatus]);

  useScrollTracking(streamRef, userScrolledRef, [loading, streamingText]);

  const availableSteps = filterAvailableSteps(world, characters, volumes);
  const activeTab = availableSteps.includes(viewTab) ? viewTab : (availableSteps[0] || "worldView");

  const handleGenerate = async () => {
    if (!(await checkConnection())) return;
    setStreamingText({});
    setCurrentStep(activeTab);
    setLoading(true);
    userScrolledRef.current = false;
    try {
      await startOutlineGeneration(activeTab);
      await syncStatus();
    } catch (e) {
      setLoading(false);
      toast.error(`生成失败: ${e}`);
    }
  };

  return { loading, currentStep, streamingText, viewTab, setViewTab, availableSteps, activeTab, handleGenerate, streamRef };
}

/** 监听滚动并自动跟随底部（用户手动上滑后停止跟随） */
function useScrollTracking(
  ref: React.RefObject<HTMLDivElement | null>,
  userScrolledRef: React.RefObject<boolean>,
  deps: React.DependencyList,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      userScrolledRef.current = !(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function filterAvailableSteps(
  world: string | undefined,
  characters: string | undefined,
  volumes: { title: string; chapters: unknown[] }[],
): OutlineStep[] {
  return OUTLINE_STEPS.filter((key) => {
    if (key === "worldView") return !!world;
    if (key === "characters") return !!characters;
    return volumes.length > 0;
  });
}
