import { useState, useEffect, useRef, useCallback } from "react";
import { List, Typography, Empty, Steps, Collapse, Card, message } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import {
  getOutlineGenerationStatus,
  onOutlineProgress,
  startOutlineGeneration,
} from "../services/tauri";
import type { OutlineProgressEvent } from "../types";
import LoadingButton from "../components/LoadingButton";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../contexts/AppContext";

const { Text } = Typography;

const STEP_KEYS = ["world", "characters", "outline"] as const;
const STEP_LABELS: Record<string, string> = {
  world: "世界观",
  characters: "角色",
  outline: "章节列表",
};

type OutlineStep = (typeof STEP_KEYS)[number];
type StreamingText = Partial<Record<OutlineStep, string>>;

function filterThinkTags(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think>/g, "");
}

export default function Outline() {
  const { novelStatus, refreshStatus } = useApp();
  const volumes = novelStatus?.outline ?? [];
  const world = novelStatus?.novel.world;
  const characters = novelStatus?.novel.characters;
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<OutlineStep | null>(null);
  const [streamingText, setStreamingText] = useState<StreamingText>({});
  const [viewTab, setViewTab] = useState<OutlineStep>("world");
  const streamRef = useRef<HTMLDivElement>(null);
  const wasRunningRef = useRef(false);
  const userScrolledRef = useRef(false);

  const syncGenerationStatus = useCallback(async () => {
    try {
      const status = await getOutlineGenerationStatus();
      setLoading(status.running);
      setCurrentStep(status.currentStep ?? null);
      setStreamingText(status.streamingText ?? {});

      if (wasRunningRef.current && !status.running) {
        if (status.completed) {
          message.success("大纲生成完成");
          refreshStatus();
        } else if (status.error) {
          message.error(`生成失败: ${status.error}`);
        }
      }
      wasRunningRef.current = status.running;
    } catch (e) {
      message.error(String(e));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    syncGenerationStatus();
  }, [syncGenerationStatus]);

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
    if (!loading) return undefined;
    const timer = window.setInterval(syncGenerationStatus, 1000);
    return () => window.clearInterval(timer);
  }, [loading, syncGenerationStatus]);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return undefined;
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

  const handleGenerate = async () => {
    setStreamingText({});
    const initialStep: OutlineStep = activeTab;
    setCurrentStep(initialStep);
    setLoading(true);
    userScrolledRef.current = false;

    try {
      await startOutlineGeneration(initialStep);
      await syncGenerationStatus();
    } catch (e) {
      setLoading(false);
      message.error(`生成失败: ${e}`);
    }
  };

  if (loading) {
    const stepIndex = currentStep ? STEP_KEYS.indexOf(currentStep) : 0;
    const displayText = currentStep
      ? filterThinkTags(streamingText[currentStep] || "")
      : "";

    return (
      <div className="fade-in">
        <Card style={{ marginBottom: 16 }}>
          <Steps
            current={stepIndex}
            items={STEP_KEYS.map((key) => ({
              title: STEP_LABELS[key],
              description:
                currentStep === key
                  ? "生成中..."
                  : STEP_KEYS.indexOf(key) < stepIndex
                    ? "已完成"
                    : "",
            }))}
          />
        </Card>
        {displayText ? (
          <div ref={streamRef} className="streaming-area md-body">
            <Markdown remarkPlugins={[remarkGfm]}>{displayText}</Markdown>
            <span className="cursor-blink">|</span>
          </div>
        ) : (
          <Card>
            <Text style={{ color: "var(--text-muted)" }}>正在连接模型...</Text>
          </Card>
        )}
      </div>
    );
  }

  const hasWorldOrCharacters = !!world || !!characters;
  const hasNothing = volumes.length === 0 && !hasWorldOrCharacters;

  if (hasNothing) {
    return (
      <div className="fade-in">
        <h1 className="page-title">大纲管理</h1>
        <Card>
          <Empty description="暂无大纲，请先生成">
            <LoadingButton
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
            >
              生成大纲
            </LoadingButton>
          </Empty>
        </Card>
      </div>
    );
  }

  const availableSteps = STEP_KEYS.filter((key) => {
    if (key === "world") return !!world;
    if (key === "characters") return !!characters;
    return volumes.length > 0;
  });

  const activeTab = availableSteps.includes(viewTab) ? viewTab : availableSteps[0];

  const renderContent = () => {
    if (activeTab === "world" && world) {
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
    if (activeTab === "outline") {
      return (
        <Collapse
          defaultActiveKey={["vol-0"]}
          items={volumes.map((vol, idx) => ({
            key: `vol-${idx}`,
            label: <Text strong>{vol.volume}</Text>,
            children: (
              <List
                size="small"
                dataSource={vol.chapters}
                renderItem={(ch) => (
                  <List.Item>
                    <Text>
                      {String(ch.num).padStart(3, "0")}. {ch.title}
                    </Text>
                  </List.Item>
                )}
              />
            ),
          }))}
        />
      );
    }
    return null;
  };

  return (
    <div className="fade-in">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 className="page-title" style={{ marginBottom: 0, paddingBottom: 0 }}>
          大纲管理
        </h1>
        <LoadingButton
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerate}
        >
          {hasNothing
            ? "生成大纲"
            : `重新生成${STEP_LABELS[activeTab] || ""}`}
        </LoadingButton>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <Steps
          current={STEP_KEYS.indexOf(activeTab)}
          items={STEP_KEYS.map((key) => {
            const available = availableSteps.includes(key);
            const completed =
              key === "world"
                ? !!world
                : key === "characters"
                  ? !!characters
                  : volumes.length > 0;
            return {
              title: STEP_LABELS[key],
              status: activeTab === key ? "process" : completed ? "finish" : "wait",
              disabled: !available,
            };
          })}
          onChange={(idx) => {
            const step = STEP_KEYS[idx];
            if (availableSteps.includes(step)) setViewTab(step);
          }}
          style={{ cursor: "pointer" }}
        />
      </Card>
      <Card>
        <div className="outline-content-area md-body" style={{ minHeight: 200 }}>
          {renderContent()}
        </div>
      </Card>
    </div>
  );
}
