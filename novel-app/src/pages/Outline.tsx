import { useState, useEffect, useRef, useCallback } from "react";
import {
  Collapse,
  List,
  Typography,
  Empty,
  Steps,
  message,
} from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import {
  getStatus,
  generateOutline,
  onOutlineProgress,
} from "../services/tauri";
import type { Volume, OutlineProgressEvent } from "../types";
import LoadingButton from "../components/LoadingButton";

const { Text } = Typography;

const STEP_KEYS = ["world", "characters", "outline"] as const;
const STEP_LABELS: Record<string, string> = {
  world: "世界观",
  characters: "角色",
  outline: "章节列表",
};

function filterThinkTags(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think>/g, "");
}

export default function Outline() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<Record<string, string>>({});
  const streamRef = useRef<HTMLDivElement>(null);

  // 流式缓冲：chunk 先写入 ref，每 80ms 批量刷到 state
  const bufferRef = useRef<Record<string, string>>({});
  const timerRef = useRef(0);

  const flushBuffer = useCallback(() => {
    const updates = bufferRef.current;
    if (Object.keys(updates).length > 0) {
      bufferRef.current = {};
      setStreamingText((prev) => {
        const next = { ...prev };
        for (const [key, val] of Object.entries(updates)) {
          next[key] = (next[key] || "") + val;
        }
        return next;
      });
    }
    timerRef.current = window.setTimeout(flushBuffer, 80);
  }, []);

  const refresh = async () => {
    try {
      const status = await getStatus();
      setVolumes(status.outline);
    } catch (e) {
      message.error(String(e));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingText]);

  const handleGenerate = async () => {
    setLoading(true);
    setStreamingText({});
    setCurrentStep("world");
    bufferRef.current = {};
    timerRef.current = window.setTimeout(flushBuffer, 80);

    const unlisten = await onOutlineProgress((e: OutlineProgressEvent) => {
      setCurrentStep(e.step);
      if (e.chunk) {
        bufferRef.current[e.step] = (bufferRef.current[e.step] || "") + e.chunk;
      }
    });

    try {
      await generateOutline();
      clearTimeout(timerRef.current);
      flushBuffer();
      message.success("大纲生成完成");
      refresh();
    } catch (e) {
      message.error(`生成失败: ${e}`);
    } finally {
      unlisten();
      clearTimeout(timerRef.current);
      setLoading(false);
      setStreamingText({});
      setCurrentStep(null);
    }
  };

  if (loading) {
    const stepIndex = currentStep
      ? STEP_KEYS.indexOf(currentStep as (typeof STEP_KEYS)[number])
      : 0;
    const displayText = currentStep
      ? filterThinkTags(streamingText[currentStep] || "")
      : "";

    return (
      <div className="fade-in">
        <Steps
          current={stepIndex}
          items={STEP_KEYS.map((key) => ({
            title: STEP_LABELS[key],
            description: currentStep === key ? "生成中..." : "",
          }))}
          style={{ marginBottom: 24 }}
        />
        {displayText && (
          <div ref={streamRef} className="streaming-area">
            {displayText}
            <span className="cursor-blink">|</span>
          </div>
        )}
      </div>
    );
  }

  if (volumes.length === 0) {
    return (
      <div className="fade-in">
        <h1 className="page-title">大纲管理</h1>
        <Empty description="暂无大纲，请先生成">
          <LoadingButton
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleGenerate}
          >
            生成大纲
          </LoadingButton>
        </Empty>
      </div>
    );
  }

  const items = volumes.map((vol, idx) => ({
    key: String(idx),
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
  }));

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
          重新生成
        </LoadingButton>
      </div>
      <Collapse items={items} defaultActiveKey={["0"]} />
    </div>
  );
}
