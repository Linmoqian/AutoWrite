import { useState, useEffect, useRef, useCallback } from "react";
import { List, Typography, Empty, message } from "antd";
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
import Markdown from "react-markdown";

const { Text } = Typography;

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

  const bufferRef = useRef("");
  const timerRef = useRef(0);

  const flushBuffer = useCallback(() => {
    if (bufferRef.current) {
      const chunk = bufferRef.current;
      bufferRef.current = "";
      setStreamingText((prev) => prev + chunk);
    }
    timerRef.current = window.setTimeout(flushBuffer, 80);
  }, []);

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
    if (generating) return;
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
    setSelected(null);
    setStreamingText("");
    bufferRef.current = "";
    timerRef.current = window.setTimeout(flushBuffer, 80);

    const unlisten = await onChapterProgress((e) => {
      if (e.chunk) {
        bufferRef.current += e.chunk;
      }
    });

    try {
      const num = await generateChapter();
      clearTimeout(timerRef.current);
      flushBuffer();
      message.success(`第 ${num} 章已生成`);
      refresh();
    } catch (e) {
      message.error(`生成失败: ${e}`);
    } finally {
      unlisten();
      clearTimeout(timerRef.current);
      setGenerating(false);
      setStreamingText("");
    }
  };

  if (chapters.length === 0 && !generating) {
    return (
      <div className="fade-in">
        <h1 className="page-title">章节管理</h1>
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

  const rightContent = generating ? (
    displayText ? (
      <div ref={streamRef} className="chapter-scroll">
        <div className="md-body">
          <Markdown>{displayText}</Markdown>
          <span className="cursor-blink">|</span>
        </div>
      </div>
    ) : (
      <div style={{ textAlign: "center", padding: 24 }}>
        <Text style={{ color: "var(--text-muted)" }}>正在连接模型...</Text>
      </div>
    )
  ) : loadingChapter ? (
    <div style={{ textAlign: "center", padding: 24 }}>
      <Text style={{ color: "var(--text-muted)" }}>加载中...</Text>
    </div>
  ) : selected ? (
    <div className="chapter-scroll">
      <div
        style={{
          fontFamily: '"KaiTi", "楷体", serif',
          fontSize: 20,
          color: "var(--text-primary)",
          marginBottom: 4,
        }}
      >
        第{selected.meta.chapter}章 {selected.meta.title}
      </div>
      <Text style={{ color: "var(--text-muted)", fontSize: 13 }}>
        {selected.meta.words} 字 | {selected.meta.created}
      </Text>
      <div
        style={{
          marginTop: 20,
          borderTop: "1px solid var(--border)",
          paddingTop: 20,
        }}
      >
        <div className="chapter-body"><Markdown>{selected.body}</Markdown></div>
      </div>
    </div>
  ) : (
    <Empty description="选择左侧章节查看内容" />
  );

  return (
    <div className="fade-in" style={{ height: "calc(100vh - 144px)", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <h1 className="page-title" style={{ marginBottom: 0, paddingBottom: 0 }}>
          章节管理
        </h1>
        <LoadingButton
          type="primary"
          icon={<FileTextOutlined />}
          onClick={handleGenerate}
          loading={generating}
        >
          写下一章
        </LoadingButton>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 220, flexShrink: 0, overflowY: "auto" }}>
          <List
            dataSource={chapters}
            renderItem={(ch) => (
              <List.Item style={{ padding: "2px 0", border: "none" }}>
                <ChapterCard
                  chapter={ch}
                  selected={selected?.meta.chapter === ch.chapter}
                  onClick={() => handleSelect(ch)}
                />
              </List.Item>
            )}
          />
        </div>
        <div style={{ width: 1, background: "var(--border)", margin: "0 16px", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {rightContent}
        </div>
      </div>
    </div>
  );
}
