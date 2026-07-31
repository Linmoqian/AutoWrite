// OpenAI 兼容 provider，照搬 src-tauri/src/ai.rs:259-443。
// 关键契约：
// - 端点 {api_base_url}/v1/chat/completions，Authorization: Bearer {api_key}
// - 请求体仅含单条 user message
// - 非流式：timeout = config.timeout；流式：timeout = config.timeout * 2
// - 重试 3 次，指数退避 2^attempt 秒
// - send 失败总重试；HTTP 非 2xx 仅 5xx 重试，否则 AiFailed("API 返回错误 {status}: {body}")
// - 流式中断：推送 [连接中断/服务端错误，正在重试 (N/M)...] chunk，重新发送整个请求，full_text 保留

import type { AppConfig } from "../config.js";
import { AppError } from "../error.js";
import {
  buildChatRequest,
  backoffDelay,
  MAX_RETRIES,
  type OnChunk,
} from "./index.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function endpoint(config: AppConfig): string {
  return `${config.api_base_url}/v1/chat/completions`;
}

// 非流式。照搬 ai.rs:259-315
export async function generateOpenai(config: AppConfig, prompt: string): Promise<string> {
  const url = endpoint(config);
  const timeoutMs = config.timeout * 1000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const body = buildChatRequest(config, prompt, false);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      // send 失败
      if (attempt < MAX_RETRIES - 1) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw AppError.aiFailed(String(e));
    }

    const status = resp.status;
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      // 仅 5xx 重试
      if (attempt < MAX_RETRIES - 1 && status >= 500 && status < 600) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw AppError.aiFailed(`API 返回错误 ${status}: ${text}`);
    }

    const data = (await resp.json()) as {
      choices?: { message: { content: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined) {
      throw AppError.aiFailed("API 返回空响应");
    }
    return content;
  }
  // 不可达：循环内每个分支都 return/continue/throw
  throw AppError.aiFailed("重试耗尽");
}

// 流式。照搬 ai.rs:317-394
export async function generateStreamingOpenai(
  config: AppConfig,
  prompt: string,
  onChunk: OnChunk,
): Promise<string> {
  const url = endpoint(config);
  const timeoutMs = config.timeout * 2 * 1000;
  let fullText = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const body = buildChatRequest(config, prompt, true);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
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

    const status = resp.status;
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      if (attempt < MAX_RETRIES - 1 && status >= 500 && status < 600) {
        onChunk(`\n\n[服务端错误，正在重试 (${attempt + 2}/${MAX_RETRIES})...]\n\n`);
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw AppError.aiFailed(`API 返回错误 ${status}: ${text}`);
    }

    // 流式解析，中途出错则重试
    try {
      await streamOpenaiResponse(resp, (chunk) => {
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

// 解析 SSE 流，照搬 ai.rs:396-443
// 按行处理：空行跳过；"data: [DONE]" 结束；"data: {json}" 提取 choices[0].delta.content
async function streamOpenaiResponse(resp: Response, onChunk: OnChunk): Promise<void> {
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
      if (line === "data: [DONE]") return;
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      let parsed: { choices?: { delta?: { content?: string } }[] };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const deltaContent = parsed.choices?.[0]?.delta?.content;
      if (deltaContent && deltaContent !== "") {
        onChunk(deltaContent);
      }
    }
  }
}
