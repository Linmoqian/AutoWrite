# AutoWrite 重构技术架构文档 v1

> 架构师：高见远 | 日期：2026-08-11 | 状态：Phase 1 调研产出

---

## 1. 总览

### 1.1 项目定位

AutoWrite 是 AI 辅助小说创作的桌面应用。用户设定参数后，AI 自动生成世界观/角色/章节大纲，再逐章流式生成正文，支持图片生成和多格式导出。

### 1.2 重构目标

- 保留 Tauri v2 框架，前后端代码全部重写
- 前端：Ant Design + Redux Toolkit → shadcn/ui + Tailwind CSS v4 + Zustand
- 后端：Rust 架构重新设计以提升可维护性

### 1.3 核心约束

- P0：锁定 Lucide React 作为唯一 SVG 图标库，禁止 emoji 图标
- P0：禁止紫色→粉色渐变方案
- P0：禁止 AI 模板味文案
- 文件规模：Rust 文件目标 ≤300 行，React 组件文件目标 ≤200 行
- 单一职责：入口只装配，按资源分包

---

## 2. 技术选型对比矩阵

### 2.1 前端 UI 框架对比

| 维度 | 方案 A: shadcn/ui + Tailwind v4 | 方案 B: Ant Design 5（当前） | 方案 C: Mantine + Tailwind |
|------|------|------|------|
| 学习成本 | 中（需理解 Radix 原语） | 低（团队已会） | 中 |
| 生态成熟度 | 高（Radix 底层 + 社区活跃） | 高 | 中 |
| 定制灵活性 | 极高（源码在项目内） | 低（token 级定制） | 高 |
| 暗色模式 | CSS 变量原生支持 | ConfigProvider 切换 | CSS 变量 |
| 桌面应用适配 | 好（轻量、无全局样式污染） | 一般（全局样式注入重） | 好 |
| 包体积 | 按需引入，极小 | 较大（全量组件库） | 中等 |
| 与 React 19 兼容 | 已验证兼容 | 兼容 | 兼容 |
| 评分 | ★★★★★ | ★★★ | ★★★★ |

**选型结论：方案 A — shadcn/ui + Tailwind CSS v4**

理由：
1. shadcn/ui 的组件源码直接复制到项目内，可自由修改，不锁定黑盒
2. Tailwind v4 使用 `@tailwindcss/vite` 插件，无 PostCSS 配置，构建链简洁
3. CSS 变量架构天然支持暗色模式，与桌面应用的 AMOLED 暗色主题契合
4. 与 Lucide React 图标库深度集成（shadcn/ui 默认依赖 lucide-react）

### 2.2 状态管理对比

| 维度 | 方案 A: Zustand | 方案 B: Redux Toolkit（当前） | 方案 C: Jotai |
|------|------|------|------|
| 学习成本 | 极低（1 个 create 函数） | 中（slice/thunk/createAsyncThunk） | 低 |
| 样板代码 | 极少 | 多（reducer/action/types） | 少 |
| 包体积 | ~1KB | ~4KB | ~2KB |
| TypeScript 支持 | 原生优秀 | 优秀（TypedUseSelectorHook） | 优秀 |
| 异步处理 | 原生支持 | 需 middleware | 原生支持 |
| 性能（万级组件） | 最优（细粒度订阅） | 中等 | 优 |
| 无 Provider | 是 | 否（需 Provider 包裹） | 是 |
| 中型应用适配 | 最优 | 偏重 | 偏轻 |
| 评分 | ★★★★★ | ★★★ | ★★★★ |

**选型结论：方案 A — Zustand**

理由：
1. 无需 Provider 包裹，简化 App 根组件结构
2. 细粒度订阅避免不必要的重渲染，对小说流式生成的长列表场景关键
3. 按领域拆分 store（appStore / novelStore / configStore / imageStore），符合中型应用最佳实践
4. API 极简，降低维护成本

### 2.3 图标库选型

| 维度 | Lucide React | Heroicons | Phosphor Icons | Tabler Icons |
|------|------|------|------|------|
| 图标数量 | 1500+ | 300+ | 9000+ | 5000+ |
| Tree-shaking | 完美 | 完美 | 完美 | 完美 |
| 单图标体积 | ~500B | ~400B | ~600B | ~500B |
| shadcn/ui 默认 | 是 | 否 | 否 | 否 |
| 暗色模式 | currentColor 支持 | 支持 | 支持 | 支持 |
| 设计一致性 | 极高 | 高 | 高 | 高 |
| 与 Tailwind 集成 | 原生 | 原生 | 良好 | 良好 |
| 评分 | ★★★★★ | ★★★★ | ★★★★ | ★★★★ |

**选型结论：Lucide React（锁定，全项目唯一图标库）**

理由：
1. shadcn/ui 默认依赖 lucide-react，零额外集成成本
2. 1500+ 图标覆盖小说创作应用的全部场景（文件操作、AI 生成、导出、设置等）
3. Tree-shaking 完美，只打包用到的图标
4. `currentColor` 原生支持，与 Tailwind 的 `text-primary` 等 semantic token 无缝配合
5. 原项目已在使用 lucide-react（`^1.31.0`），团队有基础

**版本锁定：lucide-react `^0.460.0`**
> 注意：原项目 package.json 中 lucide-react 版本号为 `^1.31.0`，这是错误的版本号。lucide-react 的正确版本范围是 `0.x`。重构时修正为 `^0.460.0`。

### 2.4 类型同步方案对比

| 维度 | 方案 A: 手写 TS 类型（当前） | 方案 B: tauri-specta | 方案 C: ts-rs |
|------|------|------|------|
| 类型安全 | 低（Rust/TS 易漂移） | 极高（编译期生成） | 高 |
| 集成成本 | 零 | 中（需加 specta 属性） | 中 |
| Tauri 命令类型 | 无 | 内置 | 无 |
| 事件类型 | 无 | 内置 | 无 |
| 维护成本 | 高（手动同步） | 低（自动生成） | 低 |
| 学习成本 | 零 | 中 | 中 |
| 评分 | ★★ | ★★★★★ | ★★★★ |

**选型结论：方案 A — 暂不引入 tauri-specta，维持手写 TS 类型**

理由：
1. MVP 阶段命令数约 20 个，手写类型可控
2. tauri-specta 需要 specta v2.0.0-rc，处于 RC 阶段，稳定性风险
3. 引入 specta 会在每个 struct 和 command 上增加 `#[derive(Type)]` 和 `#[specta::specta]` 属性，增加重构初期的认知负担
4. **升级路径**：后续如命令数增长到 40+ 或频繁出现类型漂移 bug，引入 tauri-specta 作为升级项

> 内嵌已知坑：Tauri 的 invoke 参数命名是 camelCase（前端）↔ snake_case（Rust），手写类型时必须确保两侧命名一致。重构时在 `dto/` 模块统一使用 `#[serde(rename_all = "camelCase")]` 约束。

---

## 3. 前端架构设计

### 3.1 目录结构

```text
app/src/
├── main.tsx                    # 入口，挂载 React
├── App.tsx                     # 根组件，路由装配 + Provider
├── components/
│   ├── ui/                     # shadcn/ui 生成的组件（button, card, dialog...）
│   └── common/                 # 跨 feature 复用的业务组件（≥2 个 feature 使用后提升）
├── features/
│   ├── dashboard/
│   │   ├── components/         # Dashboard 专属组件
│   │   ├── hooks/              # Dashboard 专属 hooks
│   │   └── index.tsx           # Dashboard 页面
│   ├── create-novel/
│   ├── outline/
│   ├── chapters/
│   ├── illustrations/
│   ├── export/
│   └── settings/
├── layouts/
│   └── AppLayout.tsx          # 侧边栏 + 内容区布局
├── lib/
│   ├── utils.ts                # cn() 工具函数（shadcn/ui 依赖）
│   └── constants.ts            # 常量定义
├── services/
│   └── tauri.ts                # Tauri IPC 封装层（invoke + listen）
├── stores/
│   ├── app-store.ts            # 全局状态：novelDir, loading
│   ├── novel-store.ts          # 小说状态：status, chapters, outline
│   ├── config-store.ts         # 配置状态：appConfig
│   └── image-store.ts          # 图片状态：images
├── hooks/
│   ├── use-connection-check.ts # AI 连接检测
│   ├── use-streaming.ts        # 流式生成通用 hook
│   └── use-tauri-event.ts      # Tauri 事件订阅通用 hook
├── types/
│   └── index.ts                # TypeScript 类型定义（对应 Rust DTO）
├── styles/
│   └── globals.css            # Tailwind 入口 + CSS 变量 + 全局样式
└── utils/
    ├── export-docx.ts          # DOCX 导出
    └── export-pdf.ts           # PDF 导出
```

### 3.2 分层依赖规则

```text
features/ ──→ components/common/ ──→ components/ui/ (shadcn)
    │              │
    ├──→ hooks/    ├──→ lib/
    ├──→ services/ ├──→ stores/
    └──→ types/    └──→ utils/
    
依赖方向：feature → 共用层 → 基础层
禁止反向：共用层不得 import feature；components/ui 不得 import stores
```

### 3.3 状态管理策略

**按领域拆分 4 个独立 store**：

```typescript
// stores/app-store.ts — 全局应用状态
interface AppStore {
  novelDir: string | null;
  loading: boolean;
  setNovelDir: (dir: string) => void;
  setLoading: (loading: boolean) => void;
}

// stores/novel-store.ts — 小说业务状态
interface NovelStore {
  novelStatus: NovelStatus | null;
  chapters: ChapterMeta[];
  outline: Volume[];
  // 流式生成中的临时状态
  streamingText: string;
  isGenerating: boolean;
  // actions
  refreshStatus: () => Promise<void>;
  refreshChapters: () => Promise<void>;
  appendStreamingChunk: (chunk: string) => void;
  resetStreaming: () => void;
}

// stores/config-store.ts — 配置状态
interface ConfigStore {
  config: AppConfig | null;
  refreshConfig: () => Promise<void>;
  saveConfig: (config: AppConfig) => Promise<void>;
}

// stores/image-store.ts — 图片状态
interface ImageStore {
  images: ImageResult[];
  isGenerating: boolean;
  progress: ImageProgressEvent | null;
  refreshImages: () => Promise<void>;
}
```

**设计原则**：
- 不混合状态域：每个 store 只管自己的领域
- 选择器订阅：组件用 `useNovelStore(state => state.chapters)` 精确订阅
- Rust 后端是业务数据的事实来源，前端 store 只做 UI 状态镜像
- 流式生成的临时状态（streamingText）放在 store 而非组件 state，因为需要跨组件共享

### 3.4 IPC 调用层设计

`services/tauri.ts` 保持原项目的封装模式，但做以下改进：

```typescript
// 统一错误处理
async function invokeSafe<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    // Tauri 的 AppError 实现了 Serialize → 序列化为字符串
    throw new Error(String(e));
  }
}

// 流式事件订阅统一 hook
export function useTauriEvent<T>(
  event: string,
  handler: (payload: T) => void,
): void {
  // 内部使用 listen + useEffect + cleanup
}
```

### 3.5 主题方案

采用 Tailwind v4 的 CSS 变量架构，延续原项目的暗色东方美学风格：

```css
/* styles/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

:root {
  /* 暗色为主，不提供浅色切换（桌面写作应用场景） */
  --background: hsl(230 30% 8%);       /* #111120 原项目 colorBgLayout */
  --card: hsl(230 25% 12%);            /* #191930 原项目 colorBgContainer */
  --popover: hsl(230 25% 14%);         /* #21213a 原项目 colorBgElevated */
  --primary: hsl(32 50% 62%);          /* #d4a574 原项目 colorPrimary（金棕色） */
  --primary-foreground: hsl(30 20% 95%);
  --secondary: hsl(230 15% 20%);
  --muted: hsl(230 15% 18%);
  --muted-foreground: hsl(250 10% 65%); /* #9b94a8 原项目 colorTextSecondary */
  --border: hsl(240 25% 20%);          /* #2a2a42 原项目 colorBorder */
  --input: hsl(240 25% 22%);
  --ring: hsl(32 50% 62%);
  --radius: 0.5rem;
}

@theme inline {
  --color-background: var(--background);
  --color-card: var(--card);
  --color-popover: var(--popover);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

@layer base {
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: "Microsoft YaHei", "等线", "Segoe UI", sans-serif;
  }
}
```

> 注意：不使用 `.dark` class 切换，因为本项目只有暗色模式。如果后续需要浅色模式，追加 `.light` 覆盖即可。

### 3.6 Vite 配置（重构后）

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1422,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1423 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
```

---

## 4. Rust 后端架构设计

### 4.1 模块重新划分

```text
app/src-tauri/src/
├── main.rs                      # 二进制入口（调用 lib::run）
├── lib.rs                       # 库入口：插件注册 + 命令注册 + 状态初始化
├── error.rs                     # 统一错误类型 + serde 序列化
├── state.rs                     # AppState（共享运行时状态）
├── commands/                    # Tauri IPC 边界（只做输入校验 + 调用 domain/service + 结果转换）
│   ├── mod.rs                   # 公共辅助：dir_from_state, config_from_state
│   ├── system.rs                # select_novel_dir, get_novel_dir, test_ai_connection
│   ├── novel.rs                 # create_novel, generate_outline, generate_chapter, get_status, list_chapters, read_chapter
│   ├── config.rs                # load_config, save_config, ollama_list_models, ollama_test_connection
│   ├── image.rs                 # generate_cover, generate_character_image, generate_scene_image, extract_scene_description, list_images, delete_image, get_image_path
│   └── export.rs                # get_export_data, export_novel, save_export_file
├── domain/                      # 领域模型与核心规则（不依赖 Tauri）
│   ├── mod.rs
│   ├── types.rs                 # NovelData, Volume, ChapterEntry, ContextData, ChapterMeta, EmotionalTag, TensionItem, NarrativeIntent
│   ├── config.rs                # AppConfig, Provider, Prompts, ImagePrompts, LoraConfig, fill_template
│   ├── novel.rs                 # create_novel, generate_outline_streaming, get_status
│   ├── chapter.rs               # generate_chapter_streaming, build_chapter_prompt
│   └── memory.rs                # update_memory, extract_facts, extract_intent, extract_emotion, merge_facts
├── services/                    # 外部能力封装（文件、AI、图片、导出、配置）
│   ├── mod.rs
│   ├── ai/                      # AI Provider trait + 实现
│   │   ├── mod.rs               # AiProvider trait + 工厂函数
│   │   ├── openai.rs            # OpenAIProvider 实现
│   │   └── ollama.rs            # OllamaProvider 实现
│   ├── files/                   # 文件系统操作
│   │   ├── mod.rs               # 路径辅助 + 原子写入 + YAML front matter
│   │   ├── novel.rs             # read_novel, write_novel
│   │   ├── outline.rs           # read_outline, write_outline, parse_outline_text, get_chapter_outline
│   │   ├── chapters.rs          # list_chapters, read_chapter, list_chapters_with_content
│   │   └── context.rs           # read_context, write_context
│   ├── config.rs                # load_config, save_config（YAML 读写）
│   ├── image.rs                 # ModelScope 图片生成 + 元数据管理
│   └── export.rs                # Markdown / TXT 渲染 + 数据收集
└── dto/                         # IPC 数据传输对象（面向前端的稳定契约）
    ├── mod.rs
    ├── novel.rs                # NovelStatusDto, ChapterContentDto
    ├── export.rs               # ExportDataDto, ExportChapterDto
    └── image.rs                # ImageResultDto, SceneDescriptionDto, ImageProgressEvent
```

### 4.2 AI Provider Trait 设计（核心改进）

原项目用 `match config.provider` 分支调用 openai/ollama，扩展新 provider 需改多处。重构引入 trait 抽象：

```rust
// services/ai/mod.rs

use async_trait::async_trait;
use crate::domain::config::AppConfig;
use crate::error::Result;

/// AI 生成器 trait —— 所有 provider 实现此接口
#[async_trait]
pub trait AiProvider: Send + Sync {
    /// 一次性生成
    async fn generate(&self, config: &AppConfig, prompt: &str) -> Result<String>;

    /// 流式生成，on_chunk 回调推送增量文本
    async fn generate_streaming<F>(
        &self,
        config: &AppConfig,
        prompt: &str,
        on_chunk: F,
    ) -> Result<String>
    where
        F: Fn(&str) -> Result<()> + Send + Sync + 'static;
}

/// 根据 config.provider 创建对应的 provider 实例
pub fn create_provider(config: &AppConfig) -> Box<dyn AiProvider> {
    match config.provider {
        Provider::OpenAI => Box::new(OpenAIProvider::new()),
        Provider::Ollama => Box::new(OllamaProvider::new()),
    }
}

// 公共辅助函数
pub(crate) fn build_client(timeout_secs: u64) -> Result<reqwest::Client> { ... }
pub(crate) fn retry_delay(attempt: u32) -> Duration { ... }
pub(crate) fn retries_exhausted() -> AppError { ... }
```

```rust
// services/ai/openai.rs

pub struct OpenAIProvider;

impl OpenAIProvider {
    pub fn new() -> Self { Self }
}

#[async_trait]
impl AiProvider for OpenAIProvider {
    async fn generate(&self, config: &AppConfig, prompt: &str) -> Result<String> {
        // 原有 openai::generate 逻辑
    }

    async fn generate_streaming<F>(&self, ...) -> Result<String> {
        // 原有 openai::generate_streaming 逻辑
    }
}
```

**改进点**：
1. 新增 provider 只需：新建 `xxx.rs` → impl `AiProvider` → 在 `create_provider` 加一行 match 分支
2. 命令层通过 `create_provider(config)` 获取 trait 对象，不直接依赖具体实现
3. 重试逻辑（3 次指数退避）可以下沉到 trait 的默认方法或装饰器中，避免 openai.rs/ollama.rs 重复

> 依赖新增：`async-trait = "0.1"`（Rust async trait 的标准方案，Tauri 社区广泛使用）

### 4.3 统一错误处理

保持原项目的 `AppError` 枚举 + `thiserror` + `serde::Serialize` 模式，改进点：

```rust
// error.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("YAML 解析错误: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("JSON 解析错误: {0}")]
    Json(#[from] serde_json::Error),
    #[error("HTTP 请求错误: {0}")]
    Http(#[from] reqwest::Error),
    #[error("小说未找到: {0}")]
    NovelNotFound(String),
    #[error("第 {0} 章大纲缺失，请先在「大纲管理」页面生成大纲")]
    OutlineMissing(u32),
    #[error("AI 调用失败: {0}")]
    AiFailed(String),
    #[error("未选择小说目录")]
    NoNovelDir,
    #[error("目录下已有小说「{0}」，请先选择新目录")]
    NovelAlreadyExists(String),
    #[error("导出错误: {0}")]
    Export(String),
    #[error("图片生成失败: {0}")]
    Image(String),
    #[error("配置错误: {0}")]
    Config(String),
}

// 保持原序列化方式：前端收到字符串错误消息
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_str())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
```

### 4.4 状态管理

```rust
// state.rs
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub novel_dir: Mutex<Option<PathBuf>>,
    pub config_path: Mutex<PathBuf>,
    pub outline_generation: Mutex<OutlineGenerationStatus>,
}

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineGenerationStatus {
    pub running: bool,
    pub completed: bool,
    pub current_step: Option<String>,
    pub streaming_text: HashMap<String, String>,
    pub error: Option<String>,
}
```

> 改进建议：后续如需更细粒度的并发控制，可将 `Mutex` 替换为 `RwLock`（读多写少场景）。MVP 阶段保持 `Mutex` 不变。

### 4.5 文件规模约束

| 文件 | 职责 | 目标行数 | 当前行数 | 是否需拆分 |
|------|------|----------|----------|------------|
| lib.rs | 入口装配 | ≤100 | ~113 | 基本符合 |
| commands/novel.rs | 小说命令 | ≤200 | ~160 | 符合 |
| domain/novel.rs | 大纲生成 | ≤300 | ~216 | 符合 |
| domain/chapter.rs | 章节生成 | ≤300 | ~176 | 符合 |
| domain/memory.rs | 记忆提取 | ≤200 | ~152 | 符合 |
| services/image.rs | 图片服务 | ≤300 | ~437 | 需拆分 |
| services/export.rs | 导出服务 | ≤300 | ~200 | 符合 |

**services/image.rs 拆分方案**：
- `services/image/mod.rs`：模块导出 + 公共类型（ImageKind, ImageResult, SceneDescription）
- `services/image/generate.rs`：generate_image, download_image（ModelScope API 交互）
- `services/image/prompt.rs`：build_cover_prompt, build_character_prompt, build_scene_prompt
- `services/image/meta.rs`：list_images, append_image_meta, save_all_images_meta, delete_image, generate_id
- `services/image/lora.rs`：serialize_loras + 相关测试

---

## 5. Tauri IPC 协议设计

### 5.1 命令清单

| 命令名 | 模块 | 异步 | 参数 | 返回值 | 说明 |
|--------|------|------|------|--------|------|
| `select_novel_dir` | system | 是 | 无 | `String` | 弹出目录选择对话框，返回选中路径 |
| `get_novel_dir` | system | 否 | 无 | `Option<String>` | 获取当前小说目录 |
| `test_ai_connection` | system | 是 | 无 | `ConnectionTestResult` | 测试 AI 连接 |
| `create_novel` | novel | 是 | title, genre, theme, chapters, overwrite?, prompts_override? | `()` | 创建新小说 |
| `generate_outline` | novel | 是 | 无 | `String` | 同步生成大纲（流式 emit） |
| `start_outline_generation` | novel | 是 | step? | `()` | 异步启动大纲生成（后台任务） |
| `get_outline_generation_status` | novel | 否 | 无 | `OutlineGenerationStatus` | 查询大纲生成状态 |
| `generate_chapter` | novel | 是 | 无 | `u32` | 生成下一章（流式 emit） |
| `get_status` | novel | 否 | 无 | `NovelStatus` | 获取小说状态 |
| `list_chapters` | novel | 否 | 无 | `Vec<ChapterMeta>` | 列出所有章节 |
| `read_chapter` | novel | 否 | filename | `ChapterContent` | 读取指定章节 |
| `load_config` | config | 否 | 无 | `AppConfig` | 加载配置 |
| `save_config` | config | 否 | config | `()` | 保存配置 |
| `ollama_list_models` | config | 是 | 无 | `Vec<OllamaModel>` | 列出 Ollama 模型 |
| `ollama_test_connection` | config | 是 | 无 | `OllamaTestResult` | 测试 Ollama 连接 |
| `get_export_data` | export | 否 | 无 | `ExportData` | 获取导出数据 |
| `export_novel` | export | 否 | format | `String` | 导出小说（md/txt） |
| `save_export_file` | export | 否 | content, filename, extension | `String` | 保存导出文件 |
| `generate_cover` | image | 是 | 无 | `ImageResult` | 生成封面图 |
| `generate_character_image` | image | 是 | character_name, character_desc | `ImageResult` | 生成角色图 |
| `generate_scene_image` | image | 是 | chapter_num, scene_desc, mood | `ImageResult` | 生成场景图 |
| `extract_scene_description` | image | 是 | chapter_num | `SceneDescription` | 提取场景描述 |
| `list_images` | image | 否 | 无 | `Vec<ImageResult>` | 列出所有图片 |
| `delete_image` | image | 否 | image_id | `()` | 删除图片 |
| `get_image_path` | image | 否 | filename | `String` | 获取图片路径 |

### 5.2 事件清单

| 事件名 | 发送方 | 接收方 | 载荷 | 触发时机 |
|--------|--------|--------|------|----------|
| `outline-progress` | 后端 | 前端 | `{ step, chunk, done }` | 大纲流式生成每个 chunk |
| `chapter-progress` | 后端 | 前端 | `{ chunk, done }` | 章节流式生成每个 chunk |
| `outline-generation-status` | 后端 | 前端 | `OutlineGenerationStatus` | 后台大纲任务完成/失败 |
| `image-progress` | 后端 | 前端 | `{ stage, message, imageId? }` | 图片生成进度更新 |

### 5.3 类型同步策略

**当前阶段（MVP）：手写 TS 类型 + 代码审查约束**

- `app/src/types/index.ts` 是前端类型事实来源
- `app/src-tauri/src/dto/` 是后端 IPC DTO 事实来源
- 两侧通过 `#[serde(rename_all = "camelCase")]` 统一命名约定
- PR 审查时检查 Rust DTO ↔ TS 类型一致性

**命名约定**：
- Rust DTO struct：PascalCase（如 `NovelStatusDto`）
- Rust 字段：snake_case → serde 转 camelCase → TS 用 camelCase
- 枚举值：Rust `#[serde(rename_all = "lowercase")]` → TS 字符串字面量

### 5.4 IPC 安全约束

- 文件路径在使用前必须规范化并验证位于 `novel_dir` 允许范围内
- API Key 不得出现在错误消息或日志中
- `asset_protocol_scope` 只允许 `novel_dir/images/` 目录
- capabilities 配置遵循最小授权原则

---

## 6. 版本锁定表

### 6.1 前端依赖（package.json）

| 依赖 | 锁定版本 | 用途 | 变更说明 |
|------|----------|------|----------|
| react | ^19.0.0 | UI 框架 | 不变 |
| react-dom | ^19.0.0 | DOM 渲染 | 不变 |
| react-router-dom | ^7.1.0 | 路由 | 不变 |
| @tauri-apps/api | ^2 | Tauri 前端 API | 不变 |
| @tauri-apps/plugin-dialog | ^2 | 文件对话框 | 不变 |
| **tailwindcss** | **^4.1.0** | CSS 框架 | **新增** |
| **@tailwindcss/vite** | **^4.1.0** | Vite 插件 | **新增** |
| **clsx** | **^2.1.1** | class 合并 | **新增（shadcn 依赖）** |
| **tailwind-merge** | **^3.0.0** | class 去重 | **新增（shadcn 依赖）** |
| **class-variance-authority** | **^0.7.0** | 变体管理 | **新增（shadcn 依赖）** |
| **lucide-react** | **^0.460.0** | SVG 图标库 | **版本修正（原 ^1.31.0 有误）** |
| **zustand** | **^5.0.0** | 状态管理 | **新增（替代 RTK）** |
| **tw-animate-css** | **^1.0.0** | 动画（v4 兼容） | **新增** |
| react-markdown | ^10.1.0 | Markdown 渲染 | 不变 |
| remark-gfm | ^4.0.1 | GFM 支持 | 不变 |
| docx | ^9.6.1 | DOCX 导出 | 不变 |
| ~@reduxjs/toolkit~ | ~移除~ | ~原状态管理~ | **移除** |
| ~react-redux~ | ~移除~ | ~原状态绑定~ | **移除** |
| ~antd~ | ~移除~ | ~原 UI 库~ | **移除** |

### 6.2 前端 devDependencies

| 依赖 | 锁定版本 | 用途 | 变更说明 |
|------|----------|------|----------|
| @vitejs/plugin-react | ^4.3.0 | React Vite 插件 | 不变 |
| vite | ^6.0.0 | 构建工具 | 不变 |
| typescript | ^5.7.0 | 类型检查 | 不变 |
| vitest | ^4.1.10 | 测试框架 | 不变 |
| @testing-library/react | ^16.3.2 | 组件测试 | 不变 |
| @testing-library/user-event | ^14.6.3 | 交互测试 | 不变 |
| @testing-library/jest-dom | ^7.0.1 | DOM 断言 | 不变 |
| jsdom | ^29.1.1 | DOM 环境 | 不变 |
| eslint | ^9.39.5 | 代码检查 | 不变 |
| typescript-eslint | ^8.67.0 | TS ESLint | 不变 |
| prettier | ^3.9.6 | 代码格式化 | 不变 |
| **@types/node** | **^22.0.0** | Node 类型 | **新增（path alias 需要）** |

### 6.3 Rust 依赖（Cargo.toml）

| 依赖 | 锁定版本 | 用途 | 变更说明 |
|------|----------|------|----------|
| tauri | 2 | 桌面框架 | 不变 |
| tauri-plugin-dialog | 2 | 文件对话框 | 不变 |
| serde | 1 | 序列化 | 不变 |
| serde_json | 1 | JSON 序列化 | 不变 |
| serde_yaml | 0.9 | YAML 序列化 | 不变 |
| reqwest | 0.12 | HTTP 客户端 | 不变 |
| tokio | 1 | 异步运行时 | 不变 |
| thiserror | 2 | 错误处理 | 不变 |
| chrono | 0.4 | 时间处理 | 不变 |
| dirs | 6 | 系统目录 | 不变 |
| regex | 1 | 正则表达式 | 不变 |
| **async-trait** | **0.1** | async trait | **新增（AiProvider trait）** |

---

## 7. 不可行性警告与风险

### 7.1 Lucide React 版本号问题（已解决）

原项目 `package.json` 中 `lucide-react: "^1.31.0"` 是错误的版本号。lucide-react 的 npm 最新版本是 `0.x` 系列（当前 `0.460+`）。版本号 `1.31.0` 不存在于 npm registry。重构时必须修正为 `^0.460.0`。

> 验证方式：`npm view lucide-react versions --json` 确认不存在 1.x 版本。

### 7.2 Tailwind v4 + shadcn/ui 配置坑

Tailwind v4 不使用 `tailwind.config.ts`，改用 CSS 内的 `@theme` 指令。shadcn/ui 的 `components.json` 中 `config` 字段必须为空字符串。重构时注意：

- 删除 `tailwind.config.ts`（如果存在）
- `components.json` 中 `"config": ""`
- 使用 `@tailwindcss/vite` 插件，不用 PostCSS
- 动画库从 `tailwindcss-animate` 换成 `tw-animate-css`（v4 兼容）

### 7.3 Tauri v2 Capabilities 配置

Tauri v2 引入 capabilities 权限系统。原项目已在 `lib.rs` 的 setup 中通过 `allow_image_assets` 授权图片目录。重构时需确保 `src-tauri/capabilities/` 下的配置文件包含：

- `core:default`：基础 API
- `dialog:default`：文件对话框
- `protocol-asset`：图片资源协议（已在 Cargo.toml features 中）

### 7.4 react-router-dom v7 路由变化

React Router v7 的包名从 `react-router-dom` 改为 `react-router`（但 `react-router-dom` 仍作为兼容包可用）。重构保持 `react-router-dom` 包名不变，因为 v7 的 `react-router-dom` 是 `react-router` 的超集，API 兼容。

### 7.5 Zustand v5 create() 语法

Zustand v5 在 TypeScript 中使用 middleware 时需要双括号 `create<Store>()(...)`。不使用 middleware 时单括号 `create<Store>(...)` 即可。重构中按需引入 `persist` middleware 时注意此语法。

---

## 8. ADR 架构决策记录

### ADR-001: 使用 shadcn/ui + Tailwind CSS v4 作为前端 UI 方案

- **Status**: Accepted (2026-08-11)
- **Background**: 原项目使用 Ant Design 5，全局样式注入重、定制灵活性低，不适配桌面应用的精细暗色主题需求
- **Decision**: 采用 shadcn/ui（基于 Radix UI 原语）+ Tailwind CSS v4。组件源码复制到项目内可自由修改，CSS 变量架构天然支持暗色模式
- **Consequences**:
  - 正面：定制灵活性极高，包体积按需引入极小，与 Lucide React 深度集成
  - 负面：团队需学习 Radix UI 原语概念；无全量组件库，需按需 `npx shadcn@latest add` 添加
- **Related ADRs**: ADR-003

### ADR-002: 使用 Zustand 替代 Redux Toolkit 作为状态管理

- **Status**: Accepted (2026-08-11)
- **Background**: 原项目使用 Redux Toolkit，样板代码多、Provider 包裹增加根组件复杂度、细粒度订阅需额外配置
- **Decision**: 采用 Zustand v5，按领域拆分 4 个独立 store（app/novel/config/image）
- **Consequences**:
  - 正面：API 极简（1 个 create 函数），无 Provider，细粒度订阅天然支持，包体积 ~1KB
  - 负面：失去 Redux DevTools 的时间旅行能力（Zustand 有 devtools middleware 部分弥补）
- **Related ADRs**: ADR-001

### ADR-003: 锁定 Lucide React 作为唯一 SVG 图标库

- **Status**: Accepted (2026-08-11)
- **Background**: P0 规则要求锁定一套 SVG 图标库，禁止 emoji 图标
- **Decision**: 锁定 lucide-react `^0.460.0`，全项目唯一图标库。修正原项目 `^1.31.0` 的错误版本号
- **Consequences**:
  - 正面：1500+ 图标覆盖全场景，Tree-shaking 完美，shadcn/ui 默认依赖零额外集成
  - 负面：无（原项目已在使用，团队有基础）
- **Related ADRs**: ADR-001

### ADR-004: 引入 AiProvider trait 抽象 AI 调用层

- **Status**: Accepted (2026-08-11)
- **Background**: 原项目用 `match config.provider` 分支调用 openai/ollama，重试逻辑在两个文件中重复，扩展新 provider 需改多处
- **Decision**: 定义 `AiProvider` async trait，openai.rs/ollama.rs 各实现此 trait，命令层通过 `create_provider(config)` 获取 trait 对象
- **Consequences**:
  - 正面：新增 provider 只需加一个文件 + 一行 match 分支；重试逻辑可下沉到 trait 层
  - 负面：引入 `async-trait` crate 依赖（业界标准方案，开销可忽略）
- **Related ADRs**: 无

### ADR-005: MVP 阶段维持手写 TS 类型，暂不引入 tauri-specta

- **Status**: Accepted (2026-08-11)
- **Background**: 原项目前端手写 TS 类型对应 Rust DTO，存在类型漂移风险
- **Decision**: MVP 阶段维持手写类型 + `#[serde(rename_all = "camelCase")]` 约束 + PR 审查。命令数增长到 40+ 后引入 tauri-specta
- **Consequences**:
  - 正面：零集成成本，不依赖 RC 阶段的 specta v2
  - 负面：类型漂移需靠人工审查防止
- **Related ADRs**: 无

### ADR-006: 拆分 services/image.rs 为多文件模块

- **Status**: Accepted (2026-08-11)
- **Background**: 原 `services/image.rs` 437 行，超过 300 行目标，职责混合（API 调用 + prompt 构建 + 元数据管理 + LoRA 序列化）
- **Decision**: 拆分为 `image/mod.rs` + `generate.rs` + `prompt.rs` + `meta.rs` + `lora.rs`
- **Consequences**:
  - 正面：每个文件 < 150 行，职责单一，可测试性提升
  - 负面：模块层级增加一层
- **Related ADRs**: 无

### ADR-007: 引入 dto/ 模块分离 IPC DTO 与领域类型

- **Status**: Accepted (2026-08-11)
- **Background**: 原项目命令层直接返回领域类型（如 `NovelStatus`、`ChapterContent`），领域内部类型暴露给前端
- **Decision**: 新增 `dto/` 模块，定义面向前端的稳定契约类型（如 `NovelStatusDto`、`ChapterContentDto`），命令层负责领域类型 → DTO 转换
- **Consequences**:
  - 正面：领域内部类型变更不影响前端契约；接口边界清晰
  - 负面：需编写 DTO 转换代码（通常是一行 struct 初始化）
- **Related ADRs**: ADR-005

---

## 9. 前端组件迁移映射

| 原项目组件 | 新项目对应 | 说明 |
|-----------|-----------|------|
| antd ConfigProvider + theme | Tailwind CSS 变量 `:root` | 主题由 CSS 变量驱动 |
| antd Layout/Menu | shadcn Sidebar + 自定义 | 使用 shadcn/ui sidebar 组件 |
| antd Button | shadcn Button | `npx shadcn@latest add button` |
| antd Input/TextArea | shadcn Input/Textarea | `npx shadcn@latest add input textarea` |
| antd Select | shadcn Select | `npx shadcn@latest add select` |
| antd Card | shadcn Card | `npx shadcn@latest add card` |
| antd Progress | shadcn Progress | `npx shadcn@latest add progress` |
| antd message (toast) | sonner (shadcn 推荐) | `npx shadcn@latest add sonner` |
| antd Modal/Drawer | shadcn Dialog/Sheet | `npx shadcn@latest add dialog sheet` |
| antd Tabs | shadcn Tabs | `npx shadcn@latest add tabs` |
| antd Tooltip | shadcn Tooltip | `npx shadcn@latest add tooltip` |
| antd Spin | 自定义 Spinner (lucide Loader) | 用 Lucide Loader2 + animate-spin |
| Redux Provider | 无需 Provider | Zustand 无 Provider |
| createSlice + createAsyncThunk | create<Store>() | Zustand store 定义 |
| useAppDispatch + useAppSelector | useStore(state => ...) | Zustand hook |

---

## 10. 端到端验证步骤

### 10.1 前端验证

```bash
cd /Volumes/base/project/AutoWrite-refactor/app
npm install          # 安装新依赖
npx shadcn@latest init  # 初始化 shadcn/ui
npx shadcn@latest add button card input textarea select progress dialog tabs tooltip sonner sidebar
npm run dev          # 启动开发服务器，确认页面渲染正常
npm run lint         # ESLint 检查
npm run test:run     # Vitest 单次运行
npm run build        # tsc + vite build 确认构建通过
```

### 10.2 后端验证

```bash
cd /Volumes/base/project/AutoWrite-refactor/app/src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build           # 确认编译通过
```

### 10.3 集成验证

```bash
cd /Volumes/base/project/AutoWrite-refactor/app
npm run tauri:build   # 完整构建 Tauri 应用
# 启动应用后验证：
# 1. 选择小说目录 → 目录路径正确显示
# 2. 创建小说 → novel.md 文件生成
# 3. 生成大纲 → 流式输出正常，world/characters/outline 三步骤完成
# 4. 生成章节 → 流式输出正常，章节文件写入
# 5. 生成图片 → ModelScope 轮询正常，图片下载到 images/
# 6. 导出 → Markdown/TXT/DOCX/PDF 导出正常
# 7. 设置 → 配置保存到 config.yaml，重启后加载正常
```
