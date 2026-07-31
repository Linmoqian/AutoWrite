// 连接测试，照搬 src-tauri/src/commands.rs 的三个连接相关命令。
// 字段契约：connected/latency_ms/error 用 snake_case（Rust 无 rename_all）。

import type { AppConfig } from "../config.js";

// test_ai_connection（OpenAI 分支）。照搬 commands.rs:390-440
// OpenAI：GET {api_base_url}/v1/models，10s 超时，Authorization: Bearer
// Ollama：复用 ollama_test_connection 的逻辑（GET {ollama_url}/api/tags）
export interface ConnectionTestResult {
  connected: boolean;
  latency_ms: number;
  error?: string;
}

export async function testAiConnection(config: AppConfig): Promise<ConnectionTestResult> {
  if (config.provider === "ollama") {
    return testOllamaConnection(config);
  }

  // OpenAI 分支
  if (config.api_key === "") {
    return { connected: false, latency_ms: 0, error: "未配置 API Key，请在「模型配置」页面填写" };
  }
  if (config.api_base_url === "") {
    return { connected: false, latency_ms: 0, error: "未配置 API 地址，请在「模型配置」页面填写" };
  }

  const url = `${config.api_base_url}/v1/models`;
  const start = Date.now();
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { Authorization: `Bearer ${config.api_key}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return { connected: false, latency_ms: Date.now() - start, error: String(e) };
  }
  const latencyMs = Date.now() - start;

  if (resp.ok) {
    return { connected: true, latency_ms: latencyMs };
  }
  const hint =
    resp.status === 401
      ? "API Key 无效或已过期，请检查「模型配置」"
      : `API 返回错误 HTTP ${resp.status}`;
  return { connected: false, latency_ms: latencyMs, error: hint };
}

// ollama_test_connection。照搬 commands.rs:276-305
// GET {ollama_url}/api/tags，10s 超时
export async function testOllamaConnection(config: AppConfig): Promise<ConnectionTestResult> {
  const url = `${config.ollama_url}/api/tags`;
  const start = Date.now();
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const latencyMs = Date.now() - start;
    if (resp.ok) {
      return { connected: true, latency_ms: latencyMs };
    }
    return { connected: false, latency_ms: latencyMs, error: `HTTP ${resp.status}` };
  } catch (e) {
    return { connected: false, latency_ms: Date.now() - start, error: String(e) };
  }
}

// ollama_list_models。照搬 commands.rs:233-266
// 返回 OllamaModel[]，字段 name/size/modified（snake_case）
export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}

export async function ollamaListModels(config: AppConfig): Promise<OllamaModel[]> {
  const url = `${config.ollama_url}/api/tags`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) {
    const { AppError } = await import("../error.js");
    throw AppError.aiFailed(`Ollama 连接失败: HTTP ${resp.status}`);
  }
  const body = (await resp.json()) as { models?: Array<{ name?: string; size?: number; modified_at?: string }> };
  const models: OllamaModel[] = [];
  for (const m of body.models ?? []) {
    const sizeBytes = m.size ?? 0;
    const sizeStr =
      sizeBytes >= 1_073_741_824
        ? `${(sizeBytes / 1_073_741_824).toFixed(1)} GB`
        : `${(sizeBytes / 1_048_576).toFixed(0)} MB`;
    models.push({
      name: m.name ?? "",
      size: sizeStr,
      modified: m.modified_at ?? "",
    });
  }
  return models;
}
