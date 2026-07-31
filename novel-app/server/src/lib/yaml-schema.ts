// 自定义 YAML schema：移除 timestamp 隐式类型，避免日期字符串被解析为 Date 对象。
// 对齐 serde_yaml 行为：YAML 中的 "2026-05-16" 始终保持字符串类型。

import yaml from "js-yaml";

// @types/js-yaml 未暴露 Schema.implicit/explicit 的内部结构，整体用 any 构造。
/* eslint-disable @typescript-eslint/no-explicit-any */
const defaultSchema = yaml.DEFAULT_SCHEMA as any;
const implicit = (defaultSchema.implicit as any[]).filter(
  (t: any) => t.tag !== "tag:yaml.org,2002:timestamp",
);
const SchemaCtor = yaml.Schema as any;
export const NO_TIMESTAMP_SCHEMA = new SchemaCtor({
  implicit,
  explicit: defaultSchema.explicit,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// 统一的 load/dump 封装，确保全项目一致。
export function yamlLoad(text: string): unknown {
  return yaml.load(text, { schema: NO_TIMESTAMP_SCHEMA });
}

export function yamlDump(obj: unknown): string {
  return yaml.dump(obj, {
    lineWidth: -1,
    noRefs: true,
    schema: NO_TIMESTAMP_SCHEMA,
  });
}
