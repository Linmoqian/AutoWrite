import { useState, useEffect, useRef } from "react";
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

const { Title, Text } = Typography;

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
  const [streamingText, setStreamingText] = useState<Record<string, string>>(
    {},
  );
  const streamRef = useRef<HTMLDivElement>(null);

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
  }, [streamingText, currentStep]);

  const handleGenerate = async () => {
    setLoading(true);
    setStreamingText({});
    setCurrentStep("world");

    const unlisten = await onOutlineProgress((e: OutlineProgressEvent) => {
      setCurrentStep(e.step);
      if (e.chunk) {
        setStreamingText((prev) => ({
          ...prev,
          [e.step]: (prev[e.step] || "") + e.chunk,
        }));
      }
    });

    try {
      await generateOutline();
      message.success("大纲生成完成");
      refresh();
    } catch (e) {
      message.error(`生成失败: ${e}`);
    } finally {
      unlisten();
      setLoading(false);
      setStreamingText({});
      setCurrentStep(null);
    }
  };

  if (loading) {
    const stepIndex = currentStep
      ? STEP_KEYS.indexOf(currentStep as typeof STEP_KEYS[number])
      : 0;
    const displayText = currentStep
      ? filterThinkTags(streamingText[currentStep] || "")
      : "";

    return (
      <div style={{ padding: 24 }}>
        <Steps
          current={stepIndex}
          items={STEP_KEYS.map((key) => ({
            title: STEP_LABELS[key],
            description: currentStep === key ? "生成中..." : "",
          }))}
          style={{ marginBottom: 24 }}
        />
        {displayText && (
          <div
            ref={streamRef}
            style={{
              background: "#fafafa",
              padding: 16,
              borderRadius: 8,
              maxHeight: 400,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              lineHeight: 1.8,
              fontFamily: "monospace",
              fontSize: 14,
            }}
          >
            {displayText}
            <span className="cursor-blink">|</span>
          </div>
        )}
      </div>
    );
  }

  if (volumes.length === 0) {
    return (
      <div>
        <Title level={3}>大纲管理</Title>
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
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          大纲管理
        </Title>
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
