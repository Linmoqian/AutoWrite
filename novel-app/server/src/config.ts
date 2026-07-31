// 配置管理，照搬 src-tauri/src/config.rs。
// 关键契约：
// - AppConfig / Prompts / LoraConfig 字段用 snake_case（Rust 无 rename_all）
// - ImagePrompts 字段用 camelCase（Rust #[serde(rename=...)]），同时兼容旧的 snake_case alias
// - Provider 枚举序列化为 lowercase（openai/ollama），ImageProvider 为 modelscope
// - 缺失字段回退默认值（serde(default) 语义）
// - api_base_url：serde 默认空串，仅 Default::default() 全新构造时才填 deepseek（严格复刻 Rust）

import * as fs from "node:fs";
import * as path from "node:path";

import { yamlLoad, yamlDump } from "./lib/yaml-schema.js";

import { AppError } from "./error.js";

export type Provider = "openai" | "ollama";
export type ImageProvider = "modelscope";

export interface Prompts {
  world: string;
  character: string;
  outline: string;
  chapter: string;
  extract_facts: string;
  extract_intent: string;
  extract_emotion: string;
}

export interface ImagePrompts {
  stylePrefix: string;
  cover: string;
  characterImage: string;
  scene: string;
  extractScene: string;
}

export interface LoraEntry {
  name: string;
  weight?: number;
}

export interface LoraConfig {
  entries: LoraEntry[];
}

export interface AppConfig {
  novel_dir?: string;
  provider: Provider;
  model: string;
  ollama_model: string;
  timeout: number;
  ollama_url: string;
  num_ctx: number;
  api_base_url: string;
  api_key: string;
  prompts: Prompts;
  image_provider: ImageProvider;
  image_model: string;
  image_api_base_url: string;
  image_api_key: string;
  image_size: string;
  image_prompts: ImagePrompts;
  image_loras: LoraConfig;
}

// —— 默认值（逐字对照 config.rs 的 Default impl 与各 default_* 函数）——

const DEFAULT_IMAGE_STYLE_PREFIX = "水墨风格，深色基调，金色点缀，东方美学";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_TIMEOUT = 300;
const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_NUM_CTX = 32768;
const DEFAULT_IMAGE_MODEL = "Tongyi-MAI/Z-Image-Turbo";
const DEFAULT_IMAGE_SIZE = "1024x1024";
const FALLBACK_IMAGE_API_BASE = "https://api-inference.modelscope.cn";
const DEFAULT_API_BASE_URL = "https://api.deepseek.com";

export function defaultPrompts(): Prompts {
  return {
    world:
      "请为一部{genre}类型的小说创建世界观设定。\n主题：{theme}\n要求：\n1. 修炼/能力体系（3-5个等级）\n2. 世界背景（势力分布、历史背景）\n3. 特色元素（2-3个独特的设定）\n4. 字数：500-800字\n直接输出世界观内容，不要有标题和额外说明。",
    character:
      "基于以下世界观，创建小说角色：\n{world}\n要求创建：\n1. 主角（1人）：要有独特的金手指或优势\n2. 重要配角（2-3人）：与主角有明确关系\n每个角色包含：姓名、身份、性格、与主角关系、目标\n直接输出角色信息，用列表格式。",
    outline:
      "基于以下设定，生成小说大纲：\n## 世界观\n{world}\n## 角色\n{characters}\n## 要求\n- 总章数：{total_chapters}章\n- 分卷规划（每卷20-30章）\n- 每章一行，格式：章节号. 标题\n- 主线清晰，有起承转合\n直接输出大纲，按卷分组。",
    chapter:
      "你是一位资深小说作家，正在创作一部{genre}类型小说，主题为{theme}。\n\n## 叙事核心\n{intent_block}\n\n## 事实基础\n### 角色当前位置与状态\n{character_states}\n\n### 已发生的关键事件\n{plot_events}\n\n### 尚未解决的悬念\n{tension_checklist}\n\n### 情感走向\n最近几章的情感轨迹：{emotional_arc}\n\n## 本章写作任务\n第{num}章：{title}\n\n写作要求：围绕核心叙事张力展开，用场景和对话推进剧情，\n自然处理至少一个未解决的悬念。字数约{words}字。\n直接输出章节正文内容。",
    extract_facts:
      '请从以下章节内容中提取结构化信息，严格按JSON格式输出：\n\n{\n  "character_states": [\n    {"name": "角色名", "location": "当前位置", "power_level": "当前实力", "recent_action": "最近行动", "status": "状态"}\n  ],\n  "plot_events": ["关键事件1", "关键事件2", "关键事件3"],\n  "unresolved_threads": ["未解决的悬念1", "未解决的悬念2"]\n}\n\n要求：\n- character_states 包含本章出现的所有重要角色\n- plot_events 只记录推动剧情的关键事件，最多5个\n- unresolved_threads 记录本章新增或延续的未解决线索\n\n章节内容：\n{content}',
    extract_intent:
      '请阅读以下章节内容，用简洁的语言回答三个问题：\n\n1. 角色想要什么？（一句话）\n2. 什么阻碍了他？（一句话）\n3. 读者该在意什么？（一句话）\n\n请严格按以下JSON格式输出：\n{"character_wants": "...", "obstacle": "...", "reader_should_care": "..."}\n\n章节内容：\n{content}',
    extract_emotion:
      '请为以下章节的情感走向打标签。输出JSON：\n{"tags": [{"tag": "情感标签", "intensity": 1}]}\n\n可选标签：紧张、愤怒、悲伤、温馨、热血、恐惧、希望、绝望、迷茫、震撼\nintensity范围1-5，每章最多3个标签。\n\n章节内容：\n{content}',
  };
}

export function defaultImagePrompts(): ImagePrompts {
  return {
    stylePrefix: DEFAULT_IMAGE_STYLE_PREFIX,
    cover:
      "为小说《{title}》绘制封面。类型：{genre}，主题：{theme}。\n要求：构图宏大，突出小说核心意象，适合作为书籍封面，无文字。{style_prefix}",
    characterImage:
      "为小说《{title}》中的角色「{character_name}」绘制立绘。\n角色描述：{character_desc}\n要求：全身或半身像，突出角色外貌特征和气质，背景简洁。{style_prefix}",
    scene:
      "为小说《{title}》第{chapter_num}章「{chapter_title}」绘制场景插图。\n场景描述：{scene_desc}\n氛围关键词：{mood}\n要求：以场景氛围为主，不出现清晰人脸，无文字。{style_prefix}",
    extractScene:
      '请从以下章节内容中提取适合生成场景插图的视觉描述。\n\n要求：\n1. 提取最具视觉冲击力的场景（一个即可）\n2. 将文学性描述转化为具体的视觉元素：构图、光影、色调、关键物体\n3. 用简洁的中文描述，100字以内\n4. 附带氛围关键词（2-3个词，如"阴郁、紧张"、"温暖、治愈"）\n\n请严格按以下JSON格式输出：\n{"scene_desc": "视觉场景描述", "mood": "氛围关键词1、氛围关键词2"}\n\n章节内容：\n{content}',
  };
}

export function defaultConfig(): AppConfig {
  return {
    novel_dir: undefined,
    provider: "openai",
    model: DEFAULT_MODEL,
    ollama_model: "",
    timeout: DEFAULT_TIMEOUT,
    ollama_url: DEFAULT_OLLAMA_URL,
    num_ctx: DEFAULT_NUM_CTX,
    api_base_url: DEFAULT_API_BASE_URL,
    api_key: "",
    prompts: defaultPrompts(),
    image_provider: "modelscope",
    image_model: DEFAULT_IMAGE_MODEL,
    image_api_base_url: "",
    image_api_key: "",
    image_size: DEFAULT_IMAGE_SIZE,
    image_prompts: defaultImagePrompts(),
    image_loras: { entries: [] },
  };
}

// 把任意输入归一化为完整 AppConfig（缺失字段回退默认）。
// 供 save_config 路由复用：前端可能传入部分对象，需像 serde 反序列化一样补全。
export function normalizeConfig(raw: unknown): AppConfig {
  return applySerdeDefaults(raw);
}

// serde(default) 语义：缺失字段回退。注意 api_base_url serde 默认是空串（非 deepseek）。
// load_config 对缺失字段用 serde 默认（空串）；全新 defaultConfig() 才是 deepseek。严格复刻。
function applySerdeDefaults(raw: unknown): AppConfig {
  const d = defaultConfig();
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    novel_dir: asString(o.novel_dir, d.novel_dir),
    provider: asProvider(o.provider, d.provider),
    model: asString(o.model, d.model),
    ollama_model: asString(o.ollama_model, d.ollama_model),
    timeout: asNumber(o.timeout, d.timeout),
    ollama_url: asString(o.ollama_url, d.ollama_url),
    num_ctx: asNumber(o.num_ctx, d.num_ctx),
    api_base_url: asString(o.api_base_url, ""),
    api_key: asString(o.api_key, ""),
    prompts: mergePrompts(o.prompts, d.prompts),
    image_provider: asImageProvider(o.image_provider, d.image_provider),
    image_model: asString(o.image_model, d.image_model),
    image_api_base_url: asString(o.image_api_base_url, ""),
    image_api_key: asString(o.image_api_key, ""),
    image_size: asString(o.image_size, d.image_size),
    image_prompts: mergeImagePrompts(o.image_prompts, d.image_prompts),
    image_loras: mergeLoras(o.image_loras),
  };
}

function mergePrompts(raw: unknown, d: Prompts): Prompts {
  const o = (raw ?? {}) as Record<string, unknown>;
  // extract_* 在 Rust 是 #[serde(default)]，缺失回退默认；其余字段无 default，缺失则空串
  return {
    world: asString(o.world, d.world),
    character: asString(o.character, d.character),
    outline: asString(o.outline, d.outline),
    chapter: asString(o.chapter, d.chapter),
    extract_facts: asString(o.extract_facts, d.extract_facts),
    extract_intent: asString(o.extract_intent, d.extract_intent),
    extract_emotion: asString(o.extract_emotion, d.extract_emotion),
  };
}

function mergeImagePrompts(raw: unknown, d: ImagePrompts): ImagePrompts {
  const o = (raw ?? {}) as Record<string, unknown>;
  // 兼容 camelCase 和 snake_case alias；stylePrefix 缺失回退默认前缀
  return {
    stylePrefix: asString(o.stylePrefix, asString(o.style_prefix, d.stylePrefix)),
    cover: asString(o.cover, d.cover),
    characterImage: asString(
      o.characterImage,
      asString(o.character_image, d.characterImage),
    ),
    scene: asString(o.scene, d.scene),
    extractScene: asString(
      o.extractScene,
      asString(o.extract_scene, d.extractScene),
    ),
  };
}

function mergeLoras(raw: unknown): LoraConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const entries = Array.isArray(o.entries) ? o.entries : [];
  return {
    entries: entries.map((e) => {
      const m = (e ?? {}) as Record<string, unknown>;
      return {
        name: asString(m.name, ""),
        weight:
          typeof m.weight === "number" && Number.isFinite(m.weight)
            ? m.weight
            : undefined,
      };
    }),
  };
}

function asString(v: unknown, fallback: string | undefined): string {
  return typeof v === "string" ? v : (fallback ?? "");
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asProvider(v: unknown, fallback: Provider): Provider {
  return v === "ollama" || v === "openai" ? v : fallback;
}

function asImageProvider(v: unknown, fallback: ImageProvider): ImageProvider {
  // Rust 枚举未知变体反序列化会失败；此处保守回退默认，避免崩溃
  return v === "modelscope" ? v : fallback;
}

// —— 公开 API ——

export function activeModel(c: AppConfig): string {
  if (c.provider === "ollama") {
    return c.ollama_model !== "" ? c.ollama_model : c.model;
  }
  return c.model;
}

export function imageApiBaseUrl(c: AppConfig): string {
  return c.image_api_base_url !== "" ? c.image_api_base_url : FALLBACK_IMAGE_API_BASE;
}

// fill_template：{key} -> value 的朴素替换，照搬 config.rs:208
export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// load_config：文件不存在返回默认；存在则 YAML 解析 + serde 默认回退
export function loadConfig(pathStr: string): AppConfig {
  if (!fs.existsSync(pathStr)) return defaultConfig();
  const content = fs.readFileSync(pathStr, "utf8");
  let raw: unknown;
  try {
    raw = yamlLoad(content);
  } catch (e) {
    throw AppError.yaml(e);
  }
  if (raw === null || raw === undefined) return defaultConfig();
  return applySerdeDefaults(raw);
}

// save_config：YAML 序列化。字段顺序与 Rust struct 一致
export function saveConfig(pathStr: string, config: AppConfig): void {
  const doc = configToYamlObject(config);
  let content: string;
  try {
    content = yamlDump(doc);
  } catch (e) {
    throw AppError.yaml(e);
  }
  fs.writeFileSync(pathStr, content, "utf8");
}

function configToYamlObject(c: AppConfig): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  if (c.novel_dir !== undefined) obj.novel_dir = c.novel_dir;
  obj.provider = c.provider;
  obj.model = c.model;
  obj.ollama_model = c.ollama_model;
  obj.timeout = c.timeout;
  obj.ollama_url = c.ollama_url;
  obj.num_ctx = c.num_ctx;
  obj.api_base_url = c.api_base_url;
  obj.api_key = c.api_key;
  obj.prompts = c.prompts;
  obj.image_provider = c.image_provider;
  obj.image_model = c.image_model;
  obj.image_api_base_url = c.image_api_base_url;
  obj.image_api_key = c.image_api_key;
  obj.image_size = c.image_size;
  obj.image_prompts = {
    stylePrefix: c.image_prompts.stylePrefix,
    cover: c.image_prompts.cover,
    characterImage: c.image_prompts.characterImage,
    scene: c.image_prompts.scene,
    extractScene: c.image_prompts.extractScene,
  };
  obj.image_loras = { entries: c.image_loras.entries };
  return obj;
}

// 运行时配置路径：{configDir}/autowrite/config.yaml，照搬 lib.rs:112-117
// macOS ~/Library/Application Support，Linux ~/.config，Windows %APPDATA%
// 支持 AUTOWRITE_CONFIG_PATH 环境变量覆盖，仅用于测试，避免污染真实配置。
export function defaultConfigPath(): string {
  if (process.env.AUTOWRITE_CONFIG_PATH) {
    return process.env.AUTOWRITE_CONFIG_PATH;
  }
  const configDir = systemConfigDir();
  const appDir = path.join(configDir, "autowrite");
  try {
    fs.mkdirSync(appDir, { recursive: true });
  } catch {
    // Rust 用 let _ = 忽略，这里同样忽略
  }
  return path.join(appDir, "config.yaml");
}

function systemConfigDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || ".";
  if (process.platform === "darwin") {
    return process.env.XDG_CONFIG_HOME || path.join(home, "Library", "Application Support");
  }
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(home, "AppData", "Roaming");
  }
  return process.env.XDG_CONFIG_HOME || path.join(home, ".config");
}
