// 统一错误类型，照搬 src-tauri/src/error.rs 的变体与中文文案。
// 前端通过 String(e) 消费 message，因此 AppError 序列化为纯字符串（与 Rust serde 行为一致）。

export type AppErrorVariant =
  | { kind: "Io"; message: string }
  | { kind: "Yaml"; message: string }
  | { kind: "Json"; message: string }
  | { kind: "Http"; message: string }
  | { kind: "NovelNotFound"; novel: string }
  | { kind: "OutlineMissing"; chapter: number }
  | { kind: "AiFailed"; reason: string }
  | { kind: "NoNovelDir" }
  | { kind: "NovelAlreadyExists"; novel: string }
  | { kind: "Export"; reason: string }
  | { kind: "Image"; reason: string };

// 构造各变体的辅助函数，文案与 error.rs 的 #[error("...")] 逐字对齐。
export const AppError = {
  io: (e: unknown): AppErrorVariant => ({ kind: "Io", message: ioMessage(e) }),
  yaml: (e: unknown): AppErrorVariant => ({ kind: "Yaml", message: String(e) }),
  json: (e: unknown): AppErrorVariant => ({ kind: "Json", message: String(e) }),
  http: (e: unknown): AppErrorVariant => ({ kind: "Http", message: String(e) }),
  novelNotFound: (novel: string): AppErrorVariant => ({ kind: "NovelNotFound", novel }),
  outlineMissing: (chapter: number): AppErrorVariant => ({ kind: "OutlineMissing", chapter }),
  aiFailed: (reason: string): AppErrorVariant => ({ kind: "AiFailed", reason }),
  noNovelDir: (): AppErrorVariant => ({ kind: "NoNovelDir" }),
  novelAlreadyExists: (novel: string): AppErrorVariant => ({
    kind: "NovelAlreadyExists",
    novel,
  }),
  export: (reason: string): AppErrorVariant => ({ kind: "Export", reason }),
  image: (reason: string): AppErrorVariant => ({ kind: "Image", reason }),
};

// 转成对外字符串，与 Rust Display 完全一致。
export function errorToString(e: AppErrorVariant): string {
  switch (e.kind) {
    case "Io":
      return `IO 错误: ${e.message}`;
    case "Yaml":
      return `YAML 解析错误: ${e.message}`;
    case "Json":
      return `JSON 解析错误: ${e.message}`;
    case "Http":
      return `HTTP 请求错误: ${e.message}`;
    case "NovelNotFound":
      return `小说未找到: ${e.novel}`;
    case "OutlineMissing":
      return `第 ${e.chapter} 章大纲缺失，请先在「大纲管理」页面生成大纲`;
    case "AiFailed":
      return `AI 调用失败: ${e.reason}`;
    case "NoNovelDir":
      return "未选择小说目录";
    case "NovelAlreadyExists":
      return `目录下已有小说「${e.novel}」，请先选择新目录`;
    case "Export":
      return `导出错误: ${e.reason}`;
    case "Image":
      return `图片生成失败: ${e.reason}`;
  }
}

// Node fs 错误转字符串：保留 code+message，与 reqwest::Error 的 Display 风格接近。
function ioMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// 把任意抛出物归一化为 AppErrorVariant（用于捕获未知 throw）。
export function normalizeError(e: unknown): AppErrorVariant {
  if (e && typeof e === "object" && "kind" in e) {
    return e as AppErrorVariant;
  }
  return AppError.io(e);
}
