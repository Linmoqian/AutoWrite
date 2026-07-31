// Ollama provider，照搬 src-tauri/src/ai.rs:119-255。
// 关键契约：
// - 端点 {ollama_url}/api/chat，无 Authorization
// - 请求体含 options: { num_ctx, num_predict: 4096 }
// - 非流式 timeout = config.timeout；流式 timeout = config.timeout * 2
// - 重试 3 次，指数退避 2^attempt 秒
// - 流式响应是 JSONL（每行一个 JSON），字段 message.content / done / error
// - 非流式：send 成功后直接解析 JSON（无 5xx 重试分支，与 Rust 一致）

import type { AppConfig } from "../config.js";
import { AppError } from "../error.js";
import {
  buildChatRequest,
  backoffDelay,
  MAX_RETRIES,
  type ChatRequest,
  type OnChunk,
} from "./index.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function endpoint(config: AppConfig): string {
  return `${config.ollama_url}/api/chat`;
}

// Ollama 请求体需追加 options。对应 Rust OllamaRequest
function buildOllamaRequest(config: AppConfig, prompt: string, stream: boolean): ChatRequest & {
  options: { num_ctx: number; num_predict: number };
} {
  return {
    ...buildChatRequest(config, prompt, stream),
    options: { num_ctx: config.num_ctx, num_predict: 4096 },
  };
}

// 非流式。照搬 ai.rs:119-153
export async function generateOllama(config: AppConfig, prompt: string): Promise<string> {
  const url = endpoint(config);
  const timeoutMs = config.timeout * 1000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const body = buildOllamaRequest(config, prompt, false);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Rust 直接 resp.json()，不检查 status；严格复刻
      const data = (await resp.json()) as { message?: { content?: string } };
      return data.message?.content ?? "";
    } catch (e) {
      if (attempt < MAX_RETRIES - 1) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw AppError.aiFailed(String(e));
    }
  }
  throw AppError.aiFailed("重试耗尽");
}

// 流式。照搬 ai.rs:155-210
export async function generateStreamingOllama(
  config: AppConfig,
  prompt: string,
  onChunk: OnChunk,
): Promise<string> {
  const url = endpoint(config);
  const timeoutMs = config.timeout * 2 * 1000;
  let fullText = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const body = buildOllamaRequest(config, prompt, true);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (attempt < MAX_RETRIES - 1) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw AppError.aiFailed(String(e));
    }

    try {
      await streamOllamaResponse(resp, (chunk) => {
        fullText += chunk;
        onChunk(chunk);
      });
      return fullText;
    } catch (e) {
      if (attempt < MAX_RETRIES - 1) {
        onChunk(`\n\n[连接中断，正在重试 (${attempt + 2}/${MAX_RETRIES})...]\n\n`);
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw e instanceof Error ? AppError.aiFailed(e.message) : AppError.aiFailed(String(e));
    }
  }
  throw AppError.aiFailed("重试耗尽");
}

// 解析 JSONL 流，照搬 ai.rs:212-255
// 按行处理：空行跳过；解析 JSON；error 字段抛错；message.content 非空则推送；done 字段结束
async function streamOllamaResponse(resp: Response, onChunk: OnChunk): Promise<void> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const pos = buffer.indexOf("\n");
      if (pos < 0) break;
      const line = buffer.slice(0, pos).trim();
      buffer = buffer.slice(pos + 1);
      if (line === "") continue;

      let parsed: {
        message?: { content?: string };
        done?: boolean;
        error?: string;
      };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      if (parsed.error) {
        throw AppError.aiFailed(parsed.error);
      }

      const content = parsed.message?.content;
      if (content && content !== "") {
        onChunk(content);
      }

      if (parsed.done) return;
    }
  }
}
