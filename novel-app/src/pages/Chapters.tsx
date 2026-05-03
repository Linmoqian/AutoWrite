import { useState, useEffect, useRef } from "react";
import { Row, Col, List, Typography, Empty, message } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import {
  listChapters,
  readChapter,
  generateChapter,
  onChapterProgress,
} from "../services/tauri";
import type { ChapterMeta, ChapterContent } from "../types";
import ChapterCard from "../components/ChapterCard";
import LoadingButton from "../components/LoadingButton";

const { Title, Text } = Typography;

function filterThinkTags(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think>/g, "");
}

export default function Chapters() {
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [selected, setSelected] = useState<ChapterContent | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const streamRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const list = await listChapters();
      setChapters(list);
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

  const handleSelect = async (ch: ChapterMeta) => {
    setLoadingChapter(true);
    try {
      const filename = `${String(ch.chapter).padStart(3, "0")}-${ch.title.slice(0, 10)}.md`;
      const content = await readChapter(filename);
      setSelected(content);
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoadingChapter(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setStreamingText("");

    const unlisten = await onChapterProgress((e) => {
      if (e.chunk) {
        setStreamingText((prev) => prev + e.chunk);
      }
    });

    try {
      const num = await generateChapter();
      message.success(`第 ${num} 章已生成`);
      refresh();
    } catch (e) {
      message.error(`生成失败: ${e}`);
    } finally {
      unlisten();
      setGenerating(false);
      setStreamingText("");
    }
  };

  if (chapters.length === 0 && !generating) {
    return (
      <div>
        <Title level={3}>章节管理</Title>
        <Empty description="暂无章节">
          <LoadingButton
            type="primary"
            icon={<FileTextOutlined />}
            onClick={handleGenerate}
          >
            写第一章
          </LoadingButton>
        </Empty>
      </div>
    );
  }

  const displayText = filterThinkTags(streamingText);

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
          章节管理
        </Title>
        <LoadingButton
          type="primary"
          icon={<FileTextOutlined />}
          onClick={handleGenerate}
          loading={generating}
        >
          写下一章
        </LoadingButton>
      </div>

      {generating && displayText && (
        <div
          ref={streamRef}
          style={{
            background: "#fafafa",
            padding: 16,
            borderRadius: 8,
            maxHeight: 500,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            lineHeight: 1.8,
            marginBottom: 16,
          }}
        >
          {displayText}
          <span className="cursor-blink">|</span>
        </div>
      )}

      {generating && !displayText && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Text type="secondary">正在连接模型...</Text>
        </div>
      )}

      <Row gutter={16}>
        <Col span={8}>
          <List
            dataSource={chapters}
            renderItem={(ch) => (
              <List.Item style={{ padding: 4 }}>
                <ChapterCard
                  chapter={ch}
                  selected={selected?.meta.chapter === ch.chapter}
                  onClick={() => handleSelect(ch)}
                />
              </List.Item>
            )}
          />
        </Col>
        <Col span={16}>
          {loadingChapter ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <Text type="secondary">加载中...</Text>
            </div>
          ) : selected ? (
            <div>
              <Title level={4}>
                第{selected.meta.chapter}章 {selected.meta.title}
              </Title>
              <Text type="secondary">
                {selected.meta.words} 字 | {selected.meta.created}
              </Text>
              <div
                style={{
                  marginTop: 16,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.8,
                }}
              >
                {selected.body}
              </div>
            </div>
          ) : (
            <Empty description="选择左侧章节查看内容" />
          )}
        </Col>
      </Row>
    </div>
  );
}
