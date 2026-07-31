// novel.md 读写，照搬 src-tauri/src/files.rs:186-223。
// 关键契约：world/characters 既写入 YAML front matter，又写入 body 的 # 世界观/# 角色 段；
// 读回时以 body 段为准（覆盖 YAML 值）。None 字段不写入 YAML。

import { AppError } from "../error.js";
import {
  buildYamlFrontMatter,
  nextH1Offset,
  parseYamlFrontMatter,
} from "./frontmatter.js";
import { novelFile, readFile, writeFileAtomic } from "./atomic.js";
import type { NovelData } from "./types.js";

// 序列化为 YAML 对象，跳过 None 字段（对应 serde skip_serializing_if = Option::is_none）
function novelToYamlObject(data: NovelData): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    title: data.title,
    genre: data.genre,
    theme: data.theme,
    target_chapters: data.target_chapters,
    words_per_chapter: data.words_per_chapter,
    model: data.model,
    created: data.created,
  };
  if (data.world !== undefined) obj.world = data.world;
  if (data.characters !== undefined) obj.characters = data.characters;
  return obj;
}

// 写 novel.md，照搬 files.rs:186-197
export function writeNovel(dir: string, data: NovelData): void {
  const meta = novelToYamlObject(data);
  const bodyParts: string[] = [];
  if (data.world !== undefined) {
    bodyParts.push(`# 世界观\n\n${data.world}`);
  }
  if (data.characters !== undefined) {
    bodyParts.push(`# 角色\n\n${data.characters}`);
  }
  const content = `${buildYamlFrontMatter(meta)}\n${bodyParts.join("\n\n")}`;
  writeFileAtomic(novelFile(dir), content);
}

// 读 novel.md，照搬 files.rs:199-223
export function readNovel(dir: string): NovelData {
  const content = readFile(novelFile(dir));
  if (content === "") {
    throw AppError.novelNotFound(novelFile(dir));
  }
  const [meta, body] = parseYamlFrontMatter(content);
  const data = metaToNovelData(meta);
  // world / characters 以 body 段为准
  if (body.includes("# 世界观")) {
    const after = body.split("# 世界观")[1] ?? "";
    const end = nextH1Offset(after);
    const world = after.slice(0, end).trim();
    if (world !== "") data.world = world;
  }
  if (body.includes("# 角色")) {
    const after = body.split("# 角色")[1] ?? "";
    const end = nextH1Offset(after);
    const characters = after.slice(0, end).trim();
    if (characters !== "") data.characters = characters;
  }
  return data;
}

// 把 YAML meta 反序列化为 NovelData，字段缺失时 serde 报错；此处保守给默认值（空串/0）
// 注意：Rust 用 serde_yaml::from_value，缺必填字段会抛错。这里复刻为抛 AppError。
function metaToNovelData(meta: unknown): NovelData {
  if (!meta || typeof meta !== "object") {
    throw AppError.yaml("novel front matter 缺失");
  }
  const m = meta as Record<string, unknown>;
  const required = [
    "title",
    "genre",
    "theme",
    "target_chapters",
    "words_per_chapter",
    "model",
    "created",
  ];
  for (const key of required) {
    if (!(key in m)) {
      throw AppError.yaml(`novel front matter 缺少字段: ${key}`);
    }
  }
  return {
    title: String(m.title),
    genre: String(m.genre),
    theme: String(m.theme),
    target_chapters: Number(m.target_chapters),
    words_per_chapter: Number(m.words_per_chapter),
    model: String(m.model),
    created: String(m.created),
    world: typeof m.world === "string" ? m.world : undefined,
    characters: typeof m.characters === "string" ? m.characters : undefined,
  };
}
