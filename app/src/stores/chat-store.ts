import { create } from "zustand";
import type { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean; // Sheet 抽屉开关
  isStreaming: boolean; // 是否正在接收流式回复
  streamingContent: string; // 当前流式回复的累积文本
  streamingId: string | null; // 正在生成的 assistant 消息 id

  // 抽屉开关
  open: () => void;
  close: () => void;
  toggle: () => void;

  // 消息操作
  setMessages: (msgs: ChatMessage[]) => void;
  appendMessage: (msg: ChatMessage) => void;

  // 流式生命周期
  startStreaming: (id: string) => void;
  appendChunk: (chunk: string) => void;
  finishStreaming: (finalMsg?: ChatMessage) => void;

  // 清空
  clear: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isOpen: false,
  isStreaming: false,
  streamingContent: "",
  streamingId: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  setMessages: (msgs) => set({ messages: msgs }),

  appendMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  startStreaming: (id) =>
    set({ isStreaming: true, streamingContent: "", streamingId: id }),

  appendChunk: (chunk) =>
    set((s) => ({ streamingContent: s.streamingContent + chunk })),

  finishStreaming: (finalMsg) =>
    set((s) => {
      if (finalMsg) {
        return {
          messages: [...s.messages, finalMsg],
          isStreaming: false,
          streamingContent: "",
          streamingId: null,
        };
      }
      // 未拿到 finalMsg 时，把累积内容转成一条 assistant 消息兜底
      const fallback: ChatMessage = {
        id: s.streamingId ?? crypto.randomUUID(),
        role: "assistant",
        content: s.streamingContent,
        createdAt: new Date().toISOString(),
      };
      return {
        messages: [...s.messages, fallback],
        isStreaming: false,
        streamingContent: "",
        streamingId: null,
      };
    }),

  clear: () =>
    set({
      messages: [],
      isStreaming: false,
      streamingContent: "",
      streamingId: null,
    }),
}));
