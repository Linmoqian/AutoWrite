// AI 调用统一入口，照搬 src-tauri/src/ai.rs:96-115。
// 两个公开函数 generate / generate_streaming，按 provider 分发。
// 重试逻辑（3 次、指数退避 2^attempt 秒）在各 provider 内实现，与 Rust 结构一致。

import type { AppConfig } from "../config.js";
import { activeModel } from "../config.js";
import type { AppErrorVariant } from "../error.js";

// on_chunk 回调：接收增量文本。对应 Rust 的 Fn(&str) -> Result<()>
export type OnChunk = (chunk: string) => void;

// 请求体共享字段
export interface ChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream: boolean;
}

export function buildMessages(prompt: string): { role: string; content: string }[] {
  return [{ role: "user", content: prompt }];
}

export function buildChatRequest(config: AppConfig, prompt: string, stream: boolean): ChatRequest {
  return {
    model: activeModel(config),
    messages: buildMessages(prompt),
    stream,
  };
}

// 非流式生成。照搬 ai.rs generate 的分发逻辑
export async function generate(config: AppConfig, prompt: string): Promise<string> {
  if (config.provider === "ollama") {
    const { generateOllama } = await import("./ollama.js");
    return generateOllama(config, prompt);
  }
  const { generateOpenai } = await import("./openai.js");
  return generateOpenai(config, prompt);
}

// 流式生成。照搬 ai.rs generate_streaming 的分发逻辑
export async function generateStreaming(
  config: AppConfig,
  prompt: string,
  onChunk: OnChunk,
): Promise<string> {
  if (config.provider === "ollama") {
    const { generateStreamingOllama } = await import("./ollama.js");
    return generateStreamingOllama(config, prompt, onChunk);
  }
  const { generateStreamingOpenai } = await import("./openai.js");
  return generateStreamingOpenai(config, prompt, onChunk);
}

// 重试退避：2^attempt 秒。照搬 ai.rs 的 2u64.pow(attempt as u32)
export function backoffDelay(attempt: number): number {
  return Math.pow(2, attempt) * 1000; // 毫秒
}

export const MAX_RETRIES = 3;

// 用于在重试时判断是否为可重试错误（供 provider 共享判断逻辑）
export type { AppErrorVariant };
