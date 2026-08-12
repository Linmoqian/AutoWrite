import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  streaming?: boolean; // 标记当前是否为正在打字的 assistant 消息
}

/**
 * 单条聊天消息气泡。
 * - user：右对齐，bg-primary 文字反白，右下角直角（非对称圆角）
 * - assistant：左对齐，bg-muted，左下角直角
 * - assistant 内容用 Markdown 渲染（复用全局 .md-body 样式）
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  streaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-2xl rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        ) : (
          <div className="md-body-chat">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            {streaming && <span className="cursor-blink">|</span>}
          </div>
        )}
      </div>
    </div>
  );
});
