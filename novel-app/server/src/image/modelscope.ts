// ModelScope 图片生成，照搬 src-tauri/src/image.rs:64-292, 343-377。
// 关键契约：
// - 三阶段：提交异步任务（X-ModelScope-Async-Mode）→ 轮询（3s 间隔，timeout 上限）→ 下载
// - 提交端点 POST {base}/v1/images/generations，轮询 GET {base}/v1/tasks/{task_id}
// - 重试 3 次（提交阶段），5xx 重试，4xx 直返
// - 轮询状态：SUCCEED 取 output_images[0]，FAILED 报错，其它继续
// - loras 序列化：空→omit；单条无权重→字符串；多条→对象（权重和需=1.0）
// - extract_scene：截断 3000 字节，AI 生成 JSON，剥围栏解析 {scene_desc, mood}

import type { AppConfig, ImagePrompts } from "../config.js";
import { fillTemplate, imageApiBaseUrl } from "../config.js";
import { AppError } from "../error.js";
import { generate } from "../ai/index.js";
import type { LoraConfig } from "../config.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

// 序列化 loras，照搬 image.rs:72-101
export function serializeLoras(config: LoraConfig): Record<string, unknown> | string | undefined {
  if (config.entries.length === 0) {
    return undefined;
  }
  if (config.entries.length > 6) {
    throw AppError.image("ModelScope LoRA 最多支持 6 个");
  }
  // 单条无权重 → 字符串
  if (config.entries.length === 1 && config.entries[0].weight === undefined) {
    return config.entries[0].name;
  }
  // 多条：显式权重和需为 1.0
  const explicitSum = config.entries
    .filter((e) => e.weight !== undefined)
    .reduce((s, e) => s + (e.weight ?? 0), 0);
  if (explicitSum > 0 && Math.abs(explicitSum - 1.0) > 0.001) {
    throw AppError.image(`ModelScope 多 LoRA 权重总和必须为 1.0，当前为 ${explicitSum.toFixed(3)}`);
  }
  const map: Record<string, unknown> = {};
  for (const entry of config.entries) {
    const weight = entry.weight ?? 1.0 / config.entries.length;
    map[entry.name] = weight;
  }
  return map;
}

export interface GeneratedImageData {
  bytes: Buffer;
}

// generate_image，照搬 image.rs:157-292
export async function generateImage(
  config: AppConfig,
  prompt: string,
  onStatus: (msg: string) => void,
): Promise<GeneratedImageData> {
  const baseUrl = normalizeBaseUrl(imageApiBaseUrl(config));
  const apiKey = config.image_api_key;

  if (apiKey === "") {
    throw AppError.image("ModelScope API Key 未配置，请在设置中填写");
  }

  const timeoutMs = config.timeout * 1000;
  const loras = serializeLoras(config.image_loras);
  const requestBody: Record<string, unknown> = {
    model: config.image_model,
    prompt,
  };
  if (loras !== undefined) {
    requestBody.loras = loras;
  }

  // Phase 1: 提交异步任务
  onStatus("正在提交图片生成任务...");
  const submitUrl = `${baseUrl}/v1/images/generations`;
  const maxRetries = 3;
  let taskId: string | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-ModelScope-Async-Mode": "true",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw AppError.image(String(e));
    }

    const status = resp.status;
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      if (attempt < maxRetries - 1 && status >= 500 && status < 600) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw AppError.image(`提交任务失败 ${status}: ${body}`);
    }

    const data = (await resp.json()) as { task_id?: string };
    if (!data.task_id) {
      throw AppError.image("未能获取任务 ID");
    }
    taskId = data.task_id;
    break;
  }

  if (taskId === undefined) {
    throw AppError.image("未能获取任务 ID");
  }
  onStatus(`任务已提交，等待生成 (ID: ${taskId})`);

  // Phase 2: 轮询任务状态
  const pollUrl = `${baseUrl}/v1/tasks/${taskId}`;
  const pollIntervalMs = 3000;
  const maxPollMs = timeoutMs;
  const start = Date.now();
  let imageUrl: string | undefined;

  while (true) {
    if (Date.now() - start > maxPollMs) {
      throw AppError.image("图片生成超时，请稍后重试");
    }
    await sleep(pollIntervalMs);

    let resp: Response;
    try {
      resp = await fetch(pollUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-ModelScope-Task-Type": "image_generation",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw AppError.image(String(e));
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw AppError.image(`查询任务状态失败 ${resp.status}: ${body}`);
    }

    const taskResp = (await resp.json()) as {
      task_status: string;
      output_images?: string[];
      message?: string;
      error?: string;
    };

    if (taskResp.task_status === "SUCCEED") {
      const urls = taskResp.output_images;
      if (!urls || urls.length === 0) {
        throw AppError.image("任务成功但图片列表为空");
      }
      imageUrl = urls[0];
      break;
    } else if (taskResp.task_status === "FAILED") {
      const reason = taskResp.message ?? taskResp.error ?? "ModelScope 未返回失败原因";
      throw AppError.image(`图片生成任务失败: ${reason}`);
    } else {
      onStatus("图片生成中，请稍候...");
    }
  }

  // Phase 3: 下载图片
  onStatus("图片已生成，正在下载...");
  const bytes = await downloadImage(imageUrl);
  return { bytes };
}

// download_image，照搬 image.rs:343-353
async function downloadImage(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw AppError.image(`下载图片失败: HTTP ${resp.status}`);
  }
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

// ===== Prompt 构建（照搬 image.rs:105-153）=====

export function buildCoverPrompt(prompts: ImagePrompts, title: string, genre: string, theme: string): string {
  return fillTemplate(prompts.cover, {
    title, genre, theme, style_prefix: prompts.stylePrefix,
  });
}

export function buildCharacterPrompt(prompts: ImagePrompts, title: string, name: string, desc: string): string {
  return fillTemplate(prompts.characterImage, {
    title, character_name: name, character_desc: desc, style_prefix: prompts.stylePrefix,
  });
}

export function buildScenePrompt(
  prompts: ImagePrompts,
  title: string,
  chapterNum: number,
  chapterTitle: string,
  sceneDesc: string,
  mood: string,
): string {
  return fillTemplate(prompts.scene, {
    title,
    chapter_num: String(chapterNum),
    chapter_title: chapterTitle,
    scene_desc: sceneDesc,
    mood,
    style_prefix: prompts.stylePrefix,
  });
}

// ===== 场景描述提取（照搬 image.rs:357-377）=====

export interface SceneDescription {
  scene_desc: string;
  mood: string;
}

// 注意：Rust 的 SceneDescription 用 #[serde(rename_all="camelCase")]，序列化为 sceneDesc/mood
// 但 extract_scene 命令返回给前端时字段是 sceneDesc/mood；此处内部用 scene_desc/mood，路由层转换
export async function extractScene(config: AppConfig, chapterText: string): Promise<SceneDescription> {
  // Rust: &chapter_text[..chapter_text.len().min(3000)]，字节截断（会 panic 于多字节边界）
  const truncated = truncateUtf8(chapterText, 3000);
  const prompt = fillTemplate(config.image_prompts.extractScene, { content: truncated });
  const response = await generate(config, prompt);

  const cleaned = response
    .trim()
    .replace(/^```json/, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  let desc: { scene_desc?: string; mood?: string };
  try {
    desc = JSON.parse(cleaned);
  } catch (e) {
    throw AppError.image(`解析场景描述失败: ${e}\n原始响应: ${cleaned}`);
  }
  return {
    scene_desc: desc.scene_desc ?? "",
    mood: desc.mood ?? "",
  };
}

function truncateUtf8(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= maxBytes) return s;
  let len = maxBytes;
  while (len > 0 && (buf[len] & 0xc0) === 0x80) {
    len--;
  }
  return buf.subarray(0, len).toString("utf8");
}
