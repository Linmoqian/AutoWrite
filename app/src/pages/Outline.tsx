import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { useConnectionCheck } from "@/hooks/use-connection-check";
import {
  getOutlineGenerationStatus,
  startOutlineGeneration,
} from "@/services/tauri";
import { onOutlineProgress, onOutlineGenerationStatus } from "@/services/tauri";
import { OUTLINE_STEPS, OUTLINE_STEP_LABELS } from "@/lib/constants";
import { filterThinkTags } from "@/lib/filter-think-tags";
import type { OutlineStep, OutlineProgressEvent } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type StreamingText = Partial<Record<OutlineStep, string>>;

export default function Outline() {
  const novelStatus = useAppStore((s) => s.novelStatus);
  const refreshStatus = useAppStore((s) => s.refreshStatus);
  const { checkConnection } = useConnectionCheck();

  const volumes = novelStatus?.outline ?? [];
  const world = novelStatus?.novel.worldView;
  const characters = novelStatus?.novel.characters;

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<OutlineStep | null>(null);
  const [streamingText, setStreamingText] = useState<StreamingText>({});
  const [viewTab, setViewTab] = useState<OutlineStep>("worldView");
  const streamRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const wasRunningRef = useRef(false);

  const syncStatus = useCallback(async () => {
    try {
      const st = await getOutlineGenerationStatus();
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
    } catch (e) {
      toast.error(String(e));
    }
  }, [refreshStatus]);

  useEffect(() => {
    refreshStatus();
    syncStatus();
  }, [refreshStatus, syncStatus]);

  useEffect(() => {
    const unlistenPromise = onOutlineProgress((e: OutlineProgressEvent) => {
      setLoading(true);
      setCurrentStep(e.step);
      if (e.chunk) {
        setStreamingText((prev) => ({
          ...prev,
          [e.step]: (prev[e.step] || "") + e.chunk,
        }));
      }
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = onOutlineGenerationStatus((st) => {
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
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [refreshStatus]);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledRef.current = !atBottom;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading]);

  useEffect(() => {
    if (streamRef.current && !userScrolledRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingText]);

  const availableSteps = OUTLINE_STEPS.filter((key) => {
    if (key === "worldView") return !!world;
    if (key === "characters") return !!characters;
    return volumes.length > 0;
  });

  const activeTab = availableSteps.includes(viewTab)
    ? viewTab
    : (availableSteps[0] || "worldView");

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

  if (loading) {
    return (
      <LoadingView
        currentStep={currentStep}
        streamingText={streamingText}
        streamRef={streamRef}
      />
    );
  }

  const hasWorldOrChars = !!world || !!characters;
  const hasNothing = volumes.length === 0 && !hasWorldOrChars;

  if (hasNothing) {
    return (
      <div className="fade-in">
        <h1 className="page-title">大纲管理</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <p className="text-muted-foreground">暂无大纲，请先生成</p>
            <Button onClick={handleGenerate}>
              <Zap className="mr-1.5 h-4 w-4" />
              生成大纲
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="page-title mb-0 pb-0">大纲管理</h1>
        <Button onClick={handleGenerate}>
          <Zap className="mr-1.5 h-4 w-4" />
          {hasNothing ? "生成大纲" : `重新生成${OUTLINE_STEP_LABELS[activeTab]}`}
        </Button>
      </div>

      <StepIndicator activeTab={activeTab} availableSteps={availableSteps} onTabChange={setViewTab} />

      <Card className="mt-4">
        <CardContent className="min-h-[200px] p-5">
          <OutlineContent
            activeTab={activeTab}
            world={world}
            characters={characters}
            volumes={volumes}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingView({
  currentStep,
  streamingText,
  streamRef,
}: {
  currentStep: OutlineStep | null;
  streamingText: StreamingText;
  streamRef: React.RefObject<HTMLDivElement | null>;
}) {
  const stepIndex = currentStep ? OUTLINE_STEPS.indexOf(currentStep) : 0;
  const displayText = currentStep
    ? filterThinkTags(streamingText[currentStep] || "")
    : "";

  return (
    <div className="fade-in">
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {OUTLINE_STEPS.map((key, i) => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {i < stepIndex ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : i === stepIndex ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border" />
                  )}
                  <span
                    className={
                      i === stepIndex
                        ? "text-sm font-medium text-foreground"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {OUTLINE_STEP_LABELS[key]}
                  </span>
                </div>
                {i < OUTLINE_STEPS.length - 1 && (
                  <div className="h-px w-8 bg-border" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {displayText ? (
        <div ref={streamRef} className="max-h-[60vh] overflow-y-auto">
          <div className="md-body">
            <Markdown remarkPlugins={[remarkGfm]}>{displayText}</Markdown>
            <span className="cursor-blink">|</span>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            正在连接模型...
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepIndicator({
  activeTab,
  availableSteps,
  onTabChange,
}: {
  activeTab: OutlineStep;
  availableSteps: readonly OutlineStep[];
  onTabChange: (step: OutlineStep) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {OUTLINE_STEPS.map((key, i) => {
            const available = availableSteps.includes(key);
            const active = activeTab === key;
            return (
              <div key={key} className="flex items-center gap-2">
                <button
                  disabled={!available}
                  onClick={() => onTabChange(key)}
                  className={
                    active
                      ? "text-sm font-medium text-primary"
                      : available
                        ? "text-sm text-muted-foreground hover:text-foreground"
                        : "cursor-not-allowed text-sm text-muted-foreground/40"
                  }
                >
                  <span className="mr-1.5">{i + 1}.</span>
                  {OUTLINE_STEP_LABELS[key]}
                </button>
                {i < OUTLINE_STEPS.length - 1 && (
                  <div className="h-px w-8 bg-border" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function OutlineContent({
  activeTab,
  world,
  characters,
  volumes,
}: {
  activeTab: OutlineStep;
  world?: string;
  characters?: string;
  volumes: Array<{ title: string; chapters: Array<{ number: number; title: string; summary: string }> }>;
}) {
  if (activeTab === "worldView" && world) {
    return (
      <div className="md-body">
        <Markdown remarkPlugins={[remarkGfm]}>{filterThinkTags(world)}</Markdown>
      </div>
    );
  }
  if (activeTab === "characters" && characters) {
    return (
      <div className="md-body">
        <Markdown remarkPlugins={[remarkGfm]}>{filterThinkTags(characters)}</Markdown>
      </div>
    );
  }
  if (activeTab === "outline" && volumes.length > 0) {
    return (
      <div className="space-y-3">
        {volumes.map((vol, idx) => (
          <div key={idx}>
            <div className="mb-1.5 font-medium text-foreground">{vol.title}</div>
            <div className="space-y-1 pl-4">
              {vol.chapters.map((ch) => (
                <div key={ch.number} className="text-sm text-muted-foreground">
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {String(ch.number).padStart(3, "0")}.
                  </span>{" "}
                  {ch.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-muted-foreground">暂无内容</p>;
}
