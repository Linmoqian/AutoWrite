// YAML front matter 解析/构建，照搬 src-tauri/src/files.rs:148-165。
// serde_yaml 的行为细节：
// - 多行字符串序列化为 |- 块标量（js-yaml 一致）
// - Option::None 用 skip_serializing_if 跳过（手动处理：undefined 字段不输出）
// - to_string 末尾带换行，build 时 format!("---\n{}---\n", yaml) 正好拼接

import { yamlLoad, yamlDump } from "../lib/yaml-schema.js";

import { AppError } from "../error.js";

// 解析 front matter，返回 [meta, body]。照搬 files.rs:148-158
// 要求内容以 "---\n" 开头；用 splitn(3, "---\n") 切三段。
export function parseYamlFrontMatter(content: string): [unknown, string] {
  if (!content.startsWith("---\n")) {
    return [null, content];
  }
  const parts = content.split("---\n");
  // splitn(3)：Rust 最多切 3 段；JS split 不限段数，但只取前 3 段语义
  // parts[0] 是开头空串（因为以 "---\n" 开头），parts[1] 是 YAML，parts[2]+ 是 body
  if (parts.length < 3) {
    return [null, content];
  }
  const yamlText = parts[1];
  const body = parts.slice(2).join("---\n").trim();
  let meta: unknown;
  try {
    meta = yamlLoad(yamlText) ?? null;
  } catch {
    meta = null; // Rust 用 unwrap_or(Null)
  }
  return [meta, body];
}

// 构建 front matter。照搬 files.rs:160-165
// serde_yaml::to_string 对 None 字段需手动跳过（调用方传入已清洗的对象）
export function buildYamlFrontMatter(data: Record<string, unknown>): string {
  let yamlText: string;
  try {
    yamlText = yamlDump(data);
  } catch (e) {
    throw AppError.yaml(e);
  }
  // serde_yaml::to_string 末尾带换行；js-yaml.dump 同样带换行
  return `---\n${yamlText}---\n`;
}

// 查找下一个顶级 H1 标题（# 但非 ##）的字节偏移。照搬 files.rs:168-182
// Rust 用字节扫描找 "\n# "（换行后恰好一个 # 加空格）。
// 注意：JS 字符串是 UTF-16，但中文不包含 0x0a/0x23/0x20 字节，用字符扫描等价。
export function nextH1Offset(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (
      text[i] === "\n" &&
      i + 2 < text.length &&
      text[i + 1] === "#" &&
      text[i + 2] === " "
    ) {
      return i;
    }
  }
  return text.length;
}
