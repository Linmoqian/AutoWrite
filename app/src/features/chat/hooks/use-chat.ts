import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { useChatStore } from "@/stores/chat-store";
import {
  chatSendStreaming,
  chatHistory,
  chatClear as chatClearApi,
  onChatChunk,
} from "@/services/tauri";
import type { ChatMessage } from "@/types";

const FLUSH_INTERVAL_MS = 60; // 分块刷帧节流，与章节生成一致思路

/**
 * 聊天逻辑 hook：封装 store + IPC + 流式监听 + 错误处理。
 * - 发送：立即把 user 消息塞进列表，调 chatSendStreaming，监听 chat-chunk 累积
 * - 流式：节流刷帧（避免每个 chunk 触发重渲染），done 时定稿
 * - 历史加载：抽屉首次打开时拉取 chatHistory
 */
export function useChat() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);

  const appendMessage = useChatStore((s) => s.appendMessage);
  const startStreaming = useChatStore((s) => s.startStreaming);
  const appendChunk = useChatStore((s) => s.appendChunk);
  const finishStreaming = useChatStore((s) => s.finishStreaming);
  const setMessages = useChatStore((s) => s.setMessages);
  const clearStore = useChatStore((s) => s.clear);

  const [loaded, setLoaded] = useState(false);
  const bufferRef = useRef("");
  const flushTimerRef = useRef(0);
  const streamIdRef = useRef<string | null>(null);
  const finalMsgRef = useRef<ChatMessage | null>(null);

  // 节流刷帧：把 buffer 累积的文本 flush 到 store
  const scheduleFlush = useCallback(() => {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(() => {
      if (bufferRef.current) {
        appendChunk(bufferRef.current);
        bufferRef.current = "";
      }
      if (useChatStore.getState().isStreaming) {
        scheduleFlush();
      }
    }, FLUSH_INTERVAL_MS);
  }, [appendChunk]);

  const send = useCallback(
    async (message: string) => {
      if (useChatStore.getState().isStreaming) return;

      // 立即追加 user 消息（前端乐观渲染）
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      appendMessage(userMsg);

      const assistantId = crypto.randomUUID();
      streamIdRef.current = assistantId;
      finalMsgRef.current = null;
      bufferRef.current = "";
      startStreaming(assistantId);

      // 监听流式分块
      const unlisten = onChatChunk((e) => {
        if (e.messageId) streamIdRef.current = e.messageId;
        if (e.chunk) bufferRef.current += e.chunk;
        if (e.done) {
          // done 事件后，chatSendStreaming 的返回值即为最终消息
        }
      });

      // 首帧到达前启动节流
      scheduleFlush();

      try {
        const finalMsg = await chatSendStreaming(message);
        finalMsgRef.current = finalMsg;
        clearTimeout(flushTimerRef.current);
        if (bufferRef.current) {
          appendChunk(bufferRef.current);
          bufferRef.current = "";
        }
        finishStreaming(finalMsg);
      } catch (e) {
        clearTimeout(flushTimerRef.current);
        // 流式中途失败：保留已累积内容作为兜底消息
        finishStreaming(undefined);
        toast.error(`助手回复失败: ${e}`);
      } finally {
        unlisten.then((fn) => fn());
      }
    },
    [appendMessage, startStreaming, appendChunk, finishStreaming, scheduleFlush],
  );

  // 加载历史（抽屉打开时调用一次）
  const loadHistory = useCallback(async () => {
    if (loaded) return;
    try {
      const history = await chatHistory();
      setMessages(history);
    } catch {
      // 后端命令可能尚未实现，静默忽略
    } finally {
      setLoaded(true);
    }
  }, [loaded, setMessages]);

  const clear = useCallback(async () => {
    try {
      await chatClearApi();
    } catch {
      // 后端可能未实现，静默忽略
    }
    clearStore();
  }, [clearStore]);

  // 卸载时清理定时器
  useEffect(() => {
    return () => clearTimeout(flushTimerRef.current);
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    send,
    clear,
    loadHistory,
  };
}
