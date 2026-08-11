import { useState, useEffect, useRef, useCallback } from "react";
import { List, Typography, Empty, Card, message } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { checkConnection } from "../hooks/useConnectionCheck";
import {
  readChapter,
  generateChapter,
  onChapterProgress,
} from "../services/tauri";
import type { ChapterMeta, ChapterContent } from "../types";
import ChapterCard from "../components/ChapterCard";
import LoadingButton from "../components/LoadingButton";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "../contexts/AppContext";

const { Text } = Typography;

function filterThinkTags(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think>/g, "");
}

// 模块级状态：跨组件挂载/卸载保持生成进度
const genState = {
  active: false,
  chapterNum: 0,
  text: "",
  unlisten: null as (() => void) | null,
  buffer: "",
  flushTimer: 0,
  completed: false,
  error: "",
};

export default function Chapters() {
  const { chapters, refreshChapters } = useApp();
  const [selected, setSelected] = useState<ChapterContent | null>(null);
  const [generating, setGenerating] = useState(genState.active);
  const [generatingChapter, setGeneratingChapter] = useState<number | null>(
    genState.active ? genState.chapterNum : null,
  );
  const [viewingDuringGen, setViewingDuringGen] = useState(false);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [streamingText, setStreamingText] = useState(genState.active ? genState.text : "");
  const streamRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const userScrolledRef = useRef(false);

  const flushBuffer = useCallback(() => {
    if (genState.buffer) {
      const chunk = genState.buffer;
      genState.buffer = "";
      genState.text += chunk;
      if (mountedRef.current) {
        setStreamingText(genState.text);
      }
    }
    genState.flushTimer = window.setTimeout(flushBuffer, 80);
  }, []);

  // 组件挂载/卸载跟踪
  useEffect(() => {
    mountedRef.current = true;

    // 恢复进行中的生成状态
    if (genState.active) {
      setGenerating(true);
      setGeneratingChapter(genState.chapterNum);
      setStreamingText(genState.text);
      // 重新启动 buffer 刷新
      genState.flushTimer = window.setTimeout(flushBuffer, 80);
    }

    // 检查是否有已完成但未处理的生成结果
    if (genState.completed) {
      genState.completed = false;
      message.success(`第 ${genState.chapterNum} 章已生成`);
      refreshChapters();
    }
    if (genState.error) {
      const err = genState.error;
      genState.error = "";
      message.error({ content: `生成失败: ${err}`, duration: 5 });
    }

    refreshChapters();

    return () => {
      mountedRef.current = false;
      // 不清理生成状态，保持模块级状态持久化
      clearTimeout(genState.flushTimer);
    };
  }, [flushBuffer]);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledRef.current = !atBottom;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (streamRef.current && !viewingDuringGen && !userScrolledRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingText, viewingDuringGen]);

  const handleSelect = async (ch: ChapterMeta) => {
    if (generating && ch.chapter === generatingChapter) {
      setViewingDuringGen(false);
      setSelected(null);
      return;
    }
    setLoadingChapter(true);
    try {
      const filename = `${String(ch.chapter).padStart(3, "0")}-${ch.title.slice(0, 10)}.md`;
      const content = await readChapter(filename);
      setSelected(content);
      setViewingDuringGen(generating);
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoadingChapter(false);
    }
  };

  const handleGenerate = async () => {
    if (!(await checkConnection())) return;
    const num = chapters.length > 0 ? chapters[chapters.length - 1].chapter + 1 : 1;

    // 清理之前的状态
    genState.active = true;
    genState.chapterNum = num;
    genState.text = "";
    genState.buffer = "";
    genState.completed = false;
    genState.error = "";

    setGenerating(true);
    setGeneratingChapter(num);
    setSelected(null);
    setViewingDuringGen(false);
    setStreamingText("");
    userScrolledRef.current = false;

    // 启动 buffer 刷新
    genState.flushTimer = window.setTimeout(flushBuffer, 80);

    // 订阅事件（持久化，不随组件卸载清理）
    genState.unlisten = await onChapterProgress((e) => {
      if (e.chunk) {
        genState.buffer += e.chunk;
      }
    });

    try {
      await generateChapter();
      clearTimeout(genState.flushTimer);
      flushBuffer();

      genState.active = false;
      genState.completed = true;

      if (mountedRef.current) {
        setGenerating(false);
        setGeneratingChapter(null);
        setViewingDuringGen(false);
        setStreamingText("");
        message.success(`第 ${num} 章已生成`);
        refreshChapters();
      }
    } catch (e) {
      clearTimeout(genState.flushTimer);
      genState.active = false;
      genState.error = String(e);

      if (mountedRef.current) {
        setGenerating(false);
        setGeneratingChapter(null);
        setViewingDuringGen(false);
        setStreamingText("");
        message.error({ content: `生成失败: ${e}`, duration: 5 });
      }
    } finally {
      if (genState.unlisten) {
        genState.unlisten();
        genState.unlisten = null;
      }
    }
  };

  if (chapters.length === 0 && !generating) {
    return (
      <div className="fade-in">
        <h1 className="page-title">章节管理</h1>
        <Card>
          <Empty description="暂无章节，请先在「大纲管理」页面生成大纲">
            <LoadingButton
              type="primary"
              icon={<FileTextOutlined />}
              onClick={handleGenerate}
            >
              写第一章
            </LoadingButton>
          </Empty>
        </Card>
      </div>
    );
  }

  const displayText = filterThinkTags(streamingText);

  const generatingCard = generating ? {
    chapter: generatingChapter ?? (chapters.length + 1),
    title: "创作中...",
    words: 0,
    created: "",
  } : null;

  const rightContent = generating && !viewingDuringGen ? (
    displayText ? (
      <div ref={streamRef} className="chapter-scroll">
        <div className="md-body">
          <Markdown remarkPlugins={[remarkGfm]}>{displayText}</Markdown>
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
        <div className="chapter-body"><Markdown remarkPlugins={[remarkGfm]}>{selected.body}</Markdown></div>
      </div>
    </div>
  ) : (
    <Empty description="选择左侧章节查看内容" />
  );

  const isSelected = (ch: ChapterMeta) => {
    if (generating && !viewingDuringGen) return false;
    return selected?.meta.chapter === ch.chapter;
  };

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

      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 16 }}>
        <Card
          style={{ width: 220, flexShrink: 0, overflowY: "auto", padding: 0 }}
          styles={{ body: { padding: "8px 0" } }}
        >
          <List
            dataSource={chapters}
            renderItem={(ch) => (
              <List.Item style={{ padding: "2px 0", border: "none" }}>
                <ChapterCard
                  chapter={ch}
                  selected={isSelected(ch)}
                  onClick={() => handleSelect(ch)}
                />
              </List.Item>
            )}
          />
          {generatingCard && (
            <List.Item style={{ padding: "2px 0", border: "none" }}>
              <ChapterCard
                chapter={generatingCard}
                selected={!viewingDuringGen}
                generating
                onClick={() => {
                  setViewingDuringGen(false);
                  setSelected(null);
                }}
              />
            </List.Item>
          )}
        </Card>
        <Card
          style={{ flex: 1, minWidth: 0, overflow: "hidden" }}
          styles={{ body: { padding: 0, height: "100%", overflow: "hidden" } }}
        >
          {rightContent}
        </Card>
      </div>
    </div>
  );
}
