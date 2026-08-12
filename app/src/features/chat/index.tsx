import { useEffect, useRef, useState } from "react";
import { Sparkles, Trash2, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";
import { useChat } from "./hooks/use-chat";
import { MessageBubble } from "./components/message-bubble";
import { ChatInput } from "./components/chat-input";
import { filterThinkTags } from "@/lib/filter-think-tags";

const SAMPLE_QUESTIONS = [
  "帮我改写第 3 章开头",
  "给主角起个名",
  "这段剧情合理吗",
  "第 5 章和第 2 章的人设有矛盾吗",
];

/**
 * 副驾驶聊天面板：右侧 Sheet 抽屉，含消息列表 + 输入框。
 * Sheet 开合由全局 chat-store 的 isOpen 控制（浮动按钮 toggle）。
 */
export function CopilotPanel() {
  const isOpen = useChatStore((s) => s.isOpen);
  const close = useChatStore((s) => s.close);
  const { messages, isStreaming, streamingContent, send, clear, loadHistory } =
    useChat();

  const [draft, setDraft] = useState<string | undefined>(undefined);
  const viewportRef = useRef<HTMLDivElement>(null);

  // 抽屉打开时加载历史
  useEffect(() => {
    if (isOpen) loadHistory();
  }, [isOpen, loadHistory]);

  // 新消息 / 流式内容变化时滚动到底部
  useEffect(() => {
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingContent, isOpen]);

  const handleClear = () => {
    if (messages.length === 0) return;
    clear();
  };

  const pickSample = (q: string) => {
    setDraft(q);
  };

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? null : close())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[400px]"
      >
        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between border-b border-border p-4 sm:space-y-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <SheetTitle className="text-base">副驾驶助手</SheetTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleClear}
            disabled={messages.length === 0 || isStreaming}
            aria-label="清空历史"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </SheetHeader>
        <SheetDescription className="sr-only">
          与小说创作助手对话，获取改写建议与剧情分析
        </SheetDescription>

        {/* 消息列表 */}
        <ScrollArea className="flex-1">
          <div ref={viewportRef} className="flex flex-col gap-3 p-4">
            {isEmpty ? (
              <EmptyState onPick={pickSample} />
            ) : (
              <>
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {isStreaming && (
                  <StreamingBubble
                    content={filterThinkTags(streamingContent)}
                  />
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* 输入框 */}
        <ChatInput
          onSend={send}
          disabled={isStreaming}
          draft={draft}
          onDraftConsumed={() => setDraft(undefined)}
        />
      </SheetContent>
    </Sheet>
  );
}

/** 流式进行中的 assistant 气泡 */
function StreamingBubble({ content }: { content: string }) {
  if (!content) {
    return (
      <div className="flex w-full justify-start">
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      </div>
    );
  }
  return (
    <MessageBubble
      message={{
        id: "streaming",
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      }}
      streaming
    />
  );
}

/** 空状态：欢迎语 + 示例问题 */
function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-5 px-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-medium text-foreground">和你的副驾驶聊聊创作</p>
        <p className="mt-1 text-sm text-muted-foreground">
          它了解你的小说设定与最新剧情，随时帮你打磨文字
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
