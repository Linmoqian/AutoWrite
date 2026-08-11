# AutoWrite 重构版 Spec 规格契约 v1

> 生成日期：2026-08-11
> 基于：PRD-v1 + technical-architecture-v1 + design-direction-v1
> 状态：已确认（Phase 1.5 产出，Phase 2/3/4 执行依据）

---

## 1. 产品定义

### 1.1 一句话描述

AutoWrite 是一款本地优先的 AI 辅助长篇小说创作桌面应用，通过三步大纲生成流水线、逐章流式写作配合三层叙事记忆系统，让用户从"设定参数"到"完整小说"全程自动化，同时保留本地数据所有权和离线创作能力。

### 1.2 目标用户

- **主要用户**：网文/轻小说创作者（25-40岁），有创作意愿但受限于时间和文笔
- **次要用户**：已有写作能力的网文作者，用 AI 辅助突破瓶颈和维持日更

### 1.3 核心差异化

1. **主动记忆注入 > 被动 Story Bible**：每章生成后自动提取结构化事实，自动注入下一章 Prompt
2. **本地优先 + 数据所有权**：桌面应用，所有数据本地存储，无订阅费，Ollama 可完全离线
3. **双 Provider 灵活切换**：OpenAI 兼容 API + Ollama 本地模型
4. **三步大纲流水线 + 流式预览**：世界观 → 角色 → 章节大纲，每步流式预览
5. **一体化图片生成**：封面、角色立绘、场景插图三类配图

### 1.4 技术框架

- **桌面框架**：Tauri v2（保留不变）
- **前端**：React 19 + shadcn/ui + Tailwind CSS v4 + Zustand v5
- **后端**：Rust（edition 2021），重新分层设计
- **运行平台**：Windows 10+ / macOS 12+ / Ubuntu 20.04+

---

## 2. MVP 范围

### P0（MVP 必须完成）

| 编号 | 功能 | 说明 |
|------|------|------|
| P0-1 | 前端全量重写 | 7 个页面从 Ant Design + Redux Toolkit 迁移到 shadcn/ui + Tailwind CSS + Zustand |
| P0-2 | 后端架构重设计 | Rust 代码重新分层（commands → domain → services → dto），保留 25 个命令的业务逻辑 |
| P0-3 | 核心业务逻辑完整保留 | 三步大纲生成、逐章流式生成 + 三层记忆、双 Provider、ModelScope 图片生成、多格式导出 |
| P0-4 | 流式状态重构 | 移除 Chapters.tsx 模块级 genState hack，用 Zustand store 统一管理 |
| P0-5 | 集中错误处理 | AI 五态覆盖（Loading / Empty / Error / Populated / Edge） |
| P0-6 | 暗紫色主题替换 | 暖炭黑 + 琥珀色方案，消除所有紫色背景 |

### P1（重构后紧接着迭代）

| 编号 | 功能 | 说明 |
|------|------|------|
| P1-1 | 记忆面板可视化 | 角色状态卡片、情节事件时间线、悬念清单、情感弧线图表 |
| P1-2 | DOCX 导出完善 | — |

### P2（后续迭代）

- 大纲手动编辑器
- 章节重新生成
- 章节内容编辑器

---

## 3. 明确不做（Out-of-Scope）

| 不做项 | 理由 |
|--------|------|
| 用户账号系统 / 云端同步 | 桌面应用定位为本地优先 |
| 在线协作 / 多人编辑 | 单用户创作工具定位 |
| AI 文风学习 / 风格迁移 | 技术复杂度高，ROI 不明确 |
| 可视化大纲画布 | 交互复杂度高 |
| AI 编辑工具 | 需大量 prompt 工程，后续迭代 |
| 内容审核 / 敏感词过滤 | 用户自主创作 |
| 移动端适配 | 桌面应用 |
| 付费墙 / 订阅系统 | 本地工具，免费使用 |

---

## 4. 技术架构

### 4.1 前端目录结构

```text
app/src/
├── main.tsx                    # 入口，挂载 React
├── App.tsx                     # 根组件，路由装配
├── components/
│   ├── ui/                     # shadcn/ui 组件（button, card, dialog...）
│   └── common/                 # 跨 feature 复用业务组件
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.tsx
│   ├── create-novel/
│   ├── outline/
│   ├── chapters/
│   ├── illustrations/
│   ├── export/
│   └── settings/
├── layouts/
│   └── AppLayout.tsx          # 侧边栏 + 内容区
├── lib/
│   ├── utils.ts                # cn() 工具函数
│   └── constants.ts
├── services/
│   └── tauri.ts                # Tauri IPC 封装层（invoke + listen）
├── stores/
│   ├── app-store.ts            # 全局状态：novelDir, loading
│   ├── novel-store.ts          # 小说状态：status, chapters, outline, streaming
│   ├── config-store.ts         # 配置状态：appConfig
│   └── image-store.ts          # 图片状态：images
├── hooks/
│   ├── use-connection-check.ts
│   ├── use-streaming.ts
│   └── use-tauri-event.ts
├── types/
│   └── index.ts                # TypeScript 类型（对应 Rust DTO）
├── styles/
│   └── globals.css            # Tailwind 入口 + CSS 变量
└── utils/
    ├── export-docx.ts
    └── export-pdf.ts
```

**分层依赖规则**：

```text
features/ → components/common/ → components/ui/ (shadcn)
    │              │
    ├──→ hooks/    ├──→ lib/
    ├──→ services/ ├──→ stores/
    └──→ types/    └──→ utils/

依赖方向：feature → 共用层 → 基础层
禁止反向：共用层不得 import feature；components/ui 不得 import stores
```

### 4.2 状态管理（Zustand v5，4 个领域 store）

| Store | 职责 | 关键字段 |
|-------|------|----------|
| `app-store` | 全局应用状态 | `novelDir`, `loading` |
| `novel-store` | 小说业务状态 | `novelStatus`, `chapters`, `outline`, `streamingText`, `isGenerating` |
| `config-store` | 配置状态 | `config`, `refreshConfig()`, `saveConfig()` |
| `image-store` | 图片状态 | `images`, `isGenerating`, `progress` |

**设计原则**：
- 每个 store 只管自己的领域，不混合状态域
- 组件用 `useNovelStore(state => state.chapters)` 精确订阅
- Rust 后端是业务数据的事实来源，前端 store 只做 UI 状态镜像
- 流式生成的临时状态（streamingText）放在 store 而非组件 state（跨组件共享）

### 4.3 Rust 后端模块结构

```text
app/src-tauri/src/
├── main.rs                      # 二进制入口（调用 lib::run）
├── lib.rs                       # 库入口：插件注册 + 命令注册 + 状态初始化
├── error.rs                     # 统一错误类型 + serde 序列化
├── state.rs                     # AppState（共享运行时状态）
├── commands/                    # Tauri IPC 边界
│   ├── mod.rs                   # 公共辅助：dir_from_state, config_from_state
│   ├── system.rs                # select_novel_dir, get_novel_dir, test_ai_connection
│   ├── novel.rs                 # create_novel, generate_outline, generate_chapter...
│   ├── config.rs                # load_config, save_config, ollama_*
│   ├── image.rs                 # generate_cover, generate_character_image...
│   └── export.rs                # get_export_data, export_novel, save_export_file
├── domain/                      # 领域模型与核心规则（不依赖 Tauri）
│   ├── mod.rs
│   ├── types.rs                 # NovelData, Volume, ChapterEntry, ContextData...
│   ├── config.rs                # AppConfig, Provider, Prompts, fill_template
│   ├── novel.rs                 # create_novel, generate_outline_streaming, get_status
│   ├── chapter.rs               # generate_chapter_streaming, build_chapter_prompt
│   └── memory.rs                # update_memory, extract_facts, extract_intent...
├── services/                    # 外部能力封装
│   ├── mod.rs
│   ├── ai/                      # AI Provider trait + 实现
│   │   ├── mod.rs               # AiProvider trait + 工厂函数
│   │   ├── openai.rs            # OpenAIProvider 实现
│   │   └── ollama.rs            # OllamaProvider 实现
│   ├── files/                   # 文件系统操作
│   │   ├── mod.rs               # 路径辅助 + 原子写入 + YAML front matter
│   │   ├── novel.rs
│   │   ├── outline.rs
│   │   ├── chapters.rs
│   │   └── context.rs
│   ├── config.rs                # load_config, save_config（YAML 读写）
│   ├── image/                   # ModelScope 图片生成（拆分为子模块）
│   │   ├── mod.rs               # 模块导出 + 公共类型
│   │   ├── generate.rs          # generate_image, download_image
│   │   ├── prompt.rs            # build_cover_prompt, build_character_prompt...
│   │   ├── meta.rs              # list_images, append_image_meta, delete_image...
│   │   └── lora.rs              # serialize_loras
│   └── export.rs                # Markdown / TXT 渲染 + 数据收集
└── dto/                         # IPC 数据传输对象
    ├── mod.rs
    ├── novel.rs                # NovelStatusDto, ChapterContentDto
    ├── export.rs               # ExportDataDto, ExportChapterDto
    └── image.rs                # ImageResultDto, SceneDescriptionDto, ImageProgressEvent
```

### 4.4 AI Provider Trait 设计

```rust
#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn generate(&self, config: &AppConfig, prompt: &str) -> Result<String>;
    async fn generate_streaming<F>(
        &self,
        config: &AppConfig,
        prompt: &str,
        on_chunk: F,
    ) -> Result<String>
    where
        F: Fn(&str) -> Result<()> + Send + Sync + 'static;
}

pub fn create_provider(config: &AppConfig) -> Box<dyn AiProvider> {
    match config.provider {
        Provider::OpenAI => Box::new(OpenAIProvider::new()),
        Provider::Ollama => Box::new(OllamaProvider::new()),
    }
}
```

**新增 provider 步骤**：新建 `xxx.rs` → impl `AiProvider` → 在 `create_provider` 加一行 match 分支。

### 4.5 统一错误处理

```rust
#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO 错误: {0}")] Io(#[from] std::io::Error),
    #[error("YAML 解析错误: {0}")] Yaml(#[from] serde_yaml::Error),
    #[error("JSON 解析错误: {0}")] Json(#[from] serde_json::Error),
    #[error("HTTP 请求错误: {0}")] Http(#[from] reqwest::Error),
    #[error("小说未找到: {0}")] NovelNotFound(String),
    #[error("第 {0} 章大纲缺失，请先在「大纲管理」页面生成大纲")] OutlineMissing(u32),
    #[error("AI 调用失败: {0}")] AiFailed(String),
    #[error("未选择小说目录")] NoNovelDir,
    #[error("目录下已有小说「{0}」，请先选择新目录")] NovelAlreadyExists(String),
    #[error("导出错误: {0}")] Export(String),
    #[error("图片生成失败: {0}")] Image(String),
    #[error("配置错误: {0}")] Config(String),
}

// 前端收到字符串错误消息
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(self.to_string().as_str())
    }
}
```

### 4.6 文件规模约束

| 文件 | 目标行数 |
|------|----------|
| Rust 单文件 | ≤ 300 行 |
| React 组件文件 | ≤ 200 行 |
| lib.rs（入口装配） | ≤ 100 行 |

---

## 5. Tauri 命令清单

### 5.1 命令列表（25 个）

| # | 命令名 | 模块 | 异步 | 参数 | 返回值 | 说明 |
|---|--------|------|------|------|--------|------|
| 1 | `select_novel_dir` | system | 是 | 无 | `String` | 弹出目录选择对话框 |
| 2 | `get_novel_dir` | system | 否 | 无 | `Option<String>` | 获取当前小说目录 |
| 3 | `test_ai_connection` | system | 是 | 无 | `ConnectionTestResult` | 测试 AI 连接 |
| 4 | `create_novel` | novel | 是 | title, genre, theme, chapters, overwrite?, prompts_override? | `()` | 创建新小说 |
| 5 | `generate_outline` | novel | 是 | 无 | `String` | 同步生成大纲（流式 emit） |
| 6 | `start_outline_generation` | novel | 是 | step? | `()` | 异步启动大纲生成（后台任务） |
| 7 | `get_outline_generation_status` | novel | 否 | 无 | `OutlineGenerationStatus` | 查询大纲生成状态 |
| 8 | `generate_chapter` | novel | 是 | 无 | `u32` | 生成下一章（流式 emit） |
| 9 | `get_status` | novel | 否 | 无 | `NovelStatus` | 获取小说状态 |
| 10 | `list_chapters` | novel | 否 | 无 | `Vec<ChapterMeta>` | 列出所有章节 |
| 11 | `read_chapter` | novel | 否 | filename | `ChapterContent` | 读取指定章节 |
| 12 | `load_config` | config | 否 | 无 | `AppConfig` | 加载配置 |
| 13 | `save_config` | config | 否 | config | `()` | 保存配置 |
| 14 | `ollama_list_models` | config | 是 | 无 | `Vec<OllamaModel>` | 列出 Ollama 模型 |
| 15 | `ollama_test_connection` | config | 是 | 无 | `OllamaTestResult` | 测试 Ollama 连接 |
| 16 | `get_export_data` | export | 否 | 无 | `ExportData` | 获取导出数据 |
| 17 | `export_novel` | export | 否 | format | `String` | 导出小说（md/txt） |
| 18 | `save_export_file` | export | 否 | content, filename, extension | `String` | 保存导出文件 |
| 19 | `generate_cover` | image | 是 | 无 | `ImageResult` | 生成封面图 |
| 20 | `generate_character_image` | image | 是 | character_name, character_desc | `ImageResult` | 生成角色图 |
| 21 | `generate_scene_image` | image | 是 | chapter_num, scene_desc, mood | `ImageResult` | 生成场景图 |
| 22 | `extract_scene_description` | image | 是 | chapter_num | `SceneDescription` | 提取场景描述 |
| 23 | `list_images` | image | 否 | 无 | `Vec<ImageResult>` | 列出所有图片 |
| 24 | `delete_image` | image | 否 | image_id | `()` | 删除图片 |
| 25 | `get_image_path` | image | 否 | filename | `String` | 获取图片路径 |

### 5.2 事件列表（4 个）

| 事件名 | 发送方 | 载荷 | 触发时机 |
|--------|--------|------|----------|
| `outline-progress` | 后端 | `{ step, chunk, done }` | 大纲流式生成每个 chunk |
| `chapter-progress` | 后端 | `{ chunk, done }` | 章节流式生成每个 chunk |
| `outline-generation-status` | 后端 | `OutlineGenerationStatus` | 后台大纲任务完成/失败 |
| `image-progress` | 后端 | `{ stage, message, imageId? }` | 图片生成进度更新 |

### 5.3 命名约定

- Rust DTO struct：PascalCase（如 `NovelStatusDto`）
- Rust 字段：snake_case → `#[serde(rename_all = "camelCase")]` → TS 用 camelCase
- 枚举值：Rust `#[serde(rename_all = "lowercase")]` → TS 字符串字面量
- Tauri invoke 参数：前端 camelCase ↔ Rust snake_case

### 5.4 IPC 安全约束

- 文件路径使用前必须规范化并验证位于 `novel_dir` 允许范围内
- API Key 不得出现在错误消息或日志中
- `asset_protocol_scope` 只允许 `novel_dir/images/` 目录
- capabilities 配置遵循最小授权原则

---

## 6. 文件系统数据结构

> 无数据库。所有数据以文件形式存储在用户选择的小说目录中。

### 6.1 小说目录布局

```text
{novel_dir}/
├── novel.md          # 元数据 + 世界观 + 角色设定（YAML front matter + Markdown 正文）
├── outline.md        # 章节大纲（按卷分组）
├── context.md        # 三层叙事记忆
├── chapters/         # 章节正文
│   ├── 001-标题.md
│   ├── 002-标题.md
│   └── ...
└── images/           # 图片 + 元数据
    ├── meta.json     # 图片元数据（id, kind, prompt, filename, refText...）
    ├── cover_xxx.png
    ├── char_xxx.png
    └── scene_xxx.png
```

### 6.2 全局配置

```text
~/.config/autowrite/config.yaml
```

### 6.3 数据模型（TypeScript 对应类型）

```typescript
// 小说元数据
interface NovelData {
  title: string;
  genre: string;          // 玄幻|都市|科幻|历史|言情|武侠|悬疑|其他
  theme: string;
  targetChapters: number;
  worldView: string;       // 世界观文本
  characters: string;      // 角色设定文本
  createdAt: string;
}

// 大纲
interface Volume {
  title: string;
  chapters: ChapterEntry[];
}
interface ChapterEntry {
  number: number;
  title: string;
  summary: string;         // 章节大纲摘要
}

// 三层叙事记忆
interface ContextData {
  characterStates: CharacterState[];
  plotEvents: PlotEvent[];
  unresolvedThreads: TensionItem[];
  emotionalArc: EmotionalTag[];
  currentIntent: NarrativeIntent;
}
interface CharacterState {
  name: string;
  location: string;
  powerLevel: string;
  status: string;
}
interface PlotEvent {
  chapter: number;
  event: string;
}
interface TensionItem {
  item: string;
  status: 'open' | 'resolved';
}
interface EmotionalTag {
  chapter: number;
  tag: string;
  intensity: number;
}
interface NarrativeIntent {
  characterWants: string;
  obstacle: string;
  readerShouldCare: string;
}

// 章节元数据
interface ChapterMeta {
  filename: string;
  number: number;
  title: string;
  wordCount: number;
  createdAt: string;
}

// 应用配置
interface AppConfig {
  provider: 'openai' | 'ollama';
  openai: {
    apiKey: string;
    apiUrl: string;
    model: string;
    timeout: number;
  };
  ollama: {
    apiUrl: string;
    model: string;
    timeout: number;
    numCtx: number;        // 上下文窗口大小，默认 32768
  };
  prompts: {
    worldView: string;
    characters: string;
    outline: string;
    chapter: string;
  };
  image: {
    model: string;
    apiUrl: string;
    apiToken: string;
    loras: LoraConfig[];
    size: string;
  };
}
interface LoraConfig {
  name: string;
  weight: number;
}

// 图片
interface ImageResult {
  id: string;
  kind: 'cover' | 'character' | 'scene';
  prompt: string;
  filename: string;
  refText: string;
  createdAt: string;
}
```

### 6.4 文件写入规则

- 一律使用 `write_file_atomic`：先写 `.tmp` 再 rename，带 `.bak` 备份
- YAML front matter 解析在 `services/files/mod.rs` 统一处理
- 章节文件命名格式：`{三位序号}-{标题}.md`

### 6.5 AI 调用规则

- 内置 3 次重试 + 指数退避
- 提示词模板用 `{variable}` 占位符，经 `fill_template` 填充
- Ollama `num_ctx` 可配置（默认 32768）
- `image.rs` 的 `content[:3000]` 截断改为按字符截断（修复 UTF-8 断裂 bug）

---

## 7. 页面列表

### 7.1 路由与导航

| 路由 | 页面 | Lucide 图标 | 说明 |
|------|------|-------------|------|
| `/` | Dashboard | LayoutDashboard | 小说概览、进度条、世界观/角色展示 |
| `/create` | CreateNovel | FilePlus | 表单创建小说、提示词模板编辑 |
| `/outline` | Outline | ListTree | 三步流式生成、步骤导航 |
| `/chapters` | Chapters | BookOpen | 章节列表 + 流式生成（核心页面） |
| `/illustrations` | Illustrations | ImagePlus | 三 Tab（封面/角色/场景） |
| `/export` | Export | Download | 四格式导出（MD/TXT/DOCX/PDF） |
| `/settings` | Settings | Settings | 双 Provider 配置、图片配置 |

### 7.2 页面改进方向摘要

| 页面 | 核心改进 |
|------|----------|
| Dashboard | 统计卡片 3 列网格、纯色 Progress（无渐变）、Markdown 展示世界观/角色 |
| CreateNovel | shadcn Form（react-hook-form + zod）、Collapsible 替代 Ant Collapse |
| Outline | 自定义 Stepper、移除 setInterval 轮询改用纯 Tauri 事件监听、AI 五态 |
| Chapters | Zustand store 替代模块级 genState hack、ResizablePanelGroup 左右分栏 |
| Illustrations | shadcn Tabs、CSS Grid 画廊、Dialog 全屏预览 |
| Export | 4 个 Card 选择项、Progress + Toast 通知 |
| Settings | shadcn Form、Provider RadioGroup、新增"测试连接"按钮、Sonner Toast |

### 7.3 AI 五态覆盖

每个 AI 生成场景必须实现 5 个状态：

| 状态 | 视觉 |
|------|------|
| Loading | Skeleton（animate-pulse）+ "AI 正在思考..." + Loader2 spin |
| Empty | 居中 Lucide 图标 48px + 标题 + 描述 + CTA 按钮 |
| Error | border-destructive/30 + 错误分类 + 重试按钮 |
| Populated | 正常内容展示 + 交互操作 |
| Edge | 截断处渐隐遮罩 + "展开全部"按钮 |

### 7.4 流式生成规范

| 要素 | 规范 |
|------|------|
| 打字机光标 | `|` 字符，`text-primary`，`blink 1s step-end infinite`，reduced-motion 常显 |
| 自动滚动 | 用户未手动滚动时 `scrollTop = scrollHeight`；滚动后暂停，显示"回到最新"按钮 |
| 中止按钮 | 生成中顶部固定 Banner + variant=outline 中止按钮 |
| shimmer 加载条 | 顶部 2px，`bg-primary/30`，`shimmer 2s ease-in-out infinite` |
| think 标签过滤 | `filterThinkTags(text)` 工具函数，正则 `/<think[\s\S]*?<\/think>/g` |

---

## 8. 设计令牌

### 8.1 设计风格

**温暖暗色极简（Warm Dark Minimalism）**

- 三轴刻度：Variance=4 / Motion=3 / Density=5
- 深色为默认主题（写作工具主要在夜间使用），提供浅色双主题

### 8.2 深色主题 CSS 变量（默认）

```css
:root[data-theme="dark"], .dark {
  --background: 24 6% 7%;           /* #110F0D - 暖炭黑 */
  --foreground: 36 8% 88%;           /* #E5DFD6 - 暖灰白 */
  --card: 24 5% 10%;                /* #181612 - 卡片背景 */
  --card-foreground: 36 8% 88%;
  --popover: 24 5% 12%;             /* #1E1B16 - 弹出层 */
  --popover-foreground: 36 8% 88%;
  --primary: 34 72% 56%;            /* #D89757 - 温暖琥珀 */
  --primary-foreground: 24 6% 7%;
  --secondary: 24 5% 14%;           /* #252220 */
  --secondary-foreground: 36 6% 78%;
  --muted: 24 4% 14%;               /* #232120 */
  --muted-foreground: 30 3% 52%;   /* #89857F */
  --accent: 34 72% 56%;
  --accent-foreground: 24 6% 7%;
  --destructive: 0 63% 50%;         /* #D23A3A */
  --destructive-foreground: 36 8% 95%;
  --border: 24 4% 17%;              /* #2B2825 */
  --input: 24 4% 17%;
  --ring: 34 72% 56%;
  --success: 142 52% 45%;
  --warning: 38 82% 55%;
  --info: 200 70% 55%;
  --radius: 0.5rem;
}
```

### 8.3 浅色主题 CSS 变量

```css
:root, :root[data-theme="light"] {
  --background: 40 20% 97%;          /* #FAF7F2 - 暖纸白 */
  --foreground: 24 10% 12%;          /* #231F1A - 暖深棕 */
  --card: 0 0% 100%;                 /* #FFFFFF */
  --card-foreground: 24 10% 12%;
  --popover: 0 0% 100%;
  --popover-foreground: 24 10% 12%;
  --primary: 32 65% 48%;             /* #B8732E - 深琥珀 */
  --primary-foreground: 40 20% 97%;
  --secondary: 40 15% 92%;
  --secondary-foreground: 24 8% 25%;
  --muted: 40 12% 93%;
  --muted-foreground: 24 5% 42%;
  --accent: 32 65% 48%;
  --accent-foreground: 40 20% 97%;
  --destructive: 0 72% 48%;
  --destructive-foreground: 0 0% 100%;
  --border: 35 12% 88%;
  --input: 35 12% 88%;
  --ring: 32 65% 48%;
  --success: 142 52% 38%;
  --warning: 38 82% 45%;
  --info: 200 70% 48%;
  --radius: 0.5rem;
}
```

### 8.4 字体方案

| 用途 | 字体 | 系统回退 | 字重 |
|------|------|----------|------|
| UI 标题/正文 | Inter | -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif | 400/500/600 |
| 文学内容 | Noto Serif SC | "Songti SC", "SimSun", "STSong", serif | 400/500 |
| 等宽 | JetBrains Mono | "Cascadia Code", "Fira Code", monospace | 400 |

> Tauri 注意：需将字体文件（woff2）打包到 `src/assets/fonts/` 并通过 `@font-face` 本地引用（离线场景）。建议子集化后约 300KB。

### 8.5 字号阶梯

| Token | 字号 | 行高 | 用途 |
|-------|------|------|------|
| xs | 12px | 1.4 | 标签、徽章 |
| sm | 14px | 1.5 | 次要正文 |
| base | 16px | 1.6 | 正文、按钮 |
| lg | 18px | 1.5 | 小标题 |
| xl | 20px | 1.4 | 二级标题 |
| 2xl | 24px | 1.3 | 页面主标题 |
| 3xl | 32px | 1.2 | 章节标题（文学） |

### 8.6 色彩使用规则

| 规则 | 说明 |
|------|------|
| 每屏 ≤2 处 accent | primary/accent 仅用于主 CTA、选中 Tab、关键数据高亮 |
| 中性色占 85%+ | background/card/muted/border 主导 |
| accent ≤10% | 琥珀色仅在需要用户注意时出现 |
| 语义色 ≤5% | success/warning/destructive 仅状态指示 |
| 深色模式亮度递进 | card 比 background 亮 3-5%，popover 比 card 亮 2-3% |
| 禁止纯黑纯白 | 深色不用 #000，浅色不用纯白文字 |

### 8.7 间距基准（4px 网格）

允许：`4 8 12 16 20 24 32 40 48 64 80`
禁止：`5 7 13 15 22 30` 等非标值

### 8.8 动效规范

| 场景 | 时长 | 缓动 |
|------|------|------|
| 按钮 hover/active | 150ms | ease-out |
| 输入框 focus | 150ms | ease-out |
| 卡片 hover 边框 | 200ms | ease-out |
| 页面淡入 | 300ms | ease-out |
| Modal/Dialog 进入 | 200ms | ease-out |
| 打字机光标 | 1s step-end infinite | - |
| shimmer 加载条 | 2s ease-in-out infinite | - |

**必须支持 `prefers-reduced-motion`**：打字机光标常显、shimmer 停止、页面淡入 0ms。

### 8.9 与原项目配色对比

| 维度 | 原项目 | 新方案 | 变更原因 |
|------|--------|--------|----------|
| 背景主色 | #191930（暗紫） | #110F0D（暖炭黑） | P0 违规：紫色背景必须替换 |
| 卡片背景 | #21213a（紫灰） | #181612（暖深灰） | 消除紫色调 |
| 主色 | #d4a574（金棕） | #D89757（琥珀） | 保留温暖意象，精炼色值 |
| 进度条渐变 | #a67c52→#d4a574 | 纯色 #D89757 | 禁止渐变填充 |

---

## 9. 版本锁定表

### 9.1 前端依赖（package.json）

| 依赖 | 锁定版本 | 用途 | 变更 |
|------|----------|------|------|
| react | ^19.0.0 | UI 框架 | 不变 |
| react-dom | ^19.0.0 | DOM 渲染 | 不变 |
| react-router-dom | ^7.1.0 | 路由 | 不变 |
| @tauri-apps/api | ^2 | Tauri 前端 API | 不变 |
| @tauri-apps/plugin-dialog | ^2 | 文件对话框 | 不变 |
| **tailwindcss** | **^4.1.0** | CSS 框架 | **新增** |
| **@tailwindcss/vite** | **^4.1.0** | Vite 插件 | **新增** |
| **clsx** | **^2.1.1** | class 合并 | **新增** |
| **tailwind-merge** | **^3.0.0** | class 去重 | **新增** |
| **class-variance-authority** | **^0.7.0** | 变体管理 | **新增** |
| **lucide-react** | **^0.460.0** | SVG 图标库 | **版本修正（原 ^1.31.0 有误）** |
| **zustand** | **^5.0.0** | 状态管理 | **新增（替代 RTK）** |
| **tw-animate-css** | **^1.0.0** | 动画（v4 兼容） | **新增** |
| **sonner** | **^2.0.0** | Toast 通知 | **新增（shadcn 推荐）** |
| **react-hook-form** | **^7.54.0** | 表单管理 | **新增** |
| **zod** | **^3.24.0** | 表单验证 | **新增** |
| **@hookform/resolvers** | **^3.10.0** | hook-form + zod 桥接 | **新增** |
| react-markdown | ^10.1.0 | Markdown 渲染 | 不变 |
| remark-gfm | ^4.0.1 | GFM 支持 | 不变 |
| docx | ^9.6.1 | DOCX 导出 | 不变 |
| ~@reduxjs/toolkit~ | — | — | **移除** |
| ~react-redux~ | — | — | **移除** |
| ~antd~ | — | — | **移除** |

### 9.2 前端 devDependencies

| 依赖 | 锁定版本 | 变更 |
|------|----------|------|
| @vitejs/plugin-react | ^4.3.0 | 不变 |
| vite | ^6.0.0 | 不变 |
| typescript | ^5.7.0 | 不变 |
| vitest | ^4.1.10 | 不变 |
| @testing-library/react | ^16.3.2 | 不变 |
| @testing-library/user-event | ^14.6.3 | 不变 |
| @testing-library/jest-dom | ^7.0.1 | 不变 |
| jsdom | ^29.1.1 | 不变 |
| eslint | ^9.39.5 | 不变 |
| typescript-eslint | ^8.67.0 | 不变 |
| prettier | ^3.9.6 | 不变 |
| **@types/node** | **^22.0.0** | **新增（path alias）** |

### 9.3 Rust 依赖（Cargo.toml）

| 依赖 | 锁定版本 | 变更 |
|------|----------|------|
| tauri | 2 | 不变 |
| tauri-plugin-dialog | 2 | 不变 |
| serde | 1 | 不变 |
| serde_json | 1 | 不变 |
| serde_yaml | 0.9 | 不变 |
| reqwest | 0.12 | 不变 |
| tokio | 1 | 不变 |
| thiserror | 2 | 不变 |
| chrono | 0.4 | 不变 |
| dirs | 6 | 不变 |
| regex | 1 | 不变 |
| **async-trait** | **0.1** | **新增（AiProvider trait）** |

---

## 10. 验收标准

### 10.1 大纲三步生成

- **Given** 用户已创建小说并配置了有效的 AI Provider
- **When** 用户点击"生成大纲"并选择"世界观"步骤
- **Then** 流式预览区逐步显示世界观文本，完成后世界观保存到 novel.md

### 10.2 逐章流式生成

- **Given** 大纲已生成且当前章节数 < 目标章节数
- **When** 用户点击"写下一章"
- **Then** 章节正文流式渲染到预览区，完成后文件保存为 `001-标题.md`，三层记忆自动更新

### 10.3 三层记忆更新

- **Given** 一章正文生成完成
- **When** 记忆提取流程执行
- **Then** context.md 中 character_states / plot_events / unresolved_threads / emotional_arc / current_intent 均更新

### 10.4 图片生成

- **Given** 用户已配置 ModelScope API Token
- **When** 用户在场景插图页选择章节并点击"AI 提取场景"
- **Then** AI 从章节正文提取场景描述，用户确认后生成图片并保存到 images/

### 10.5 多格式导出

- **Given** 小说已有至少 1 章正文
- **When** 用户选择导出格式并点击导出
- **Then** 系统弹出保存对话框，文件写入成功（MD/TXT 后端生成，DOCX 前端生成，PDF 打印视图）

### 10.6 错误处理

- **Given** AI Provider 不可达
- **When** 用户触发任何 AI 生成操作
- **Then** 显示明确的错误分类，提供重试按钮和降级方案提示

### 10.7 前端构建验证

- `npm run build`（tsc 严格模式 + vite build）零错误
- `npm run lint` 零警告

### 10.8 后端构建验证

- `cargo fmt --check` 通过
- `cargo clippy --all-targets -- -D warnings` 零警告
- `cargo test` 全部通过
- `cargo build` 编译通过

### 10.9 集成验证

- `npm run tauri:build` 完整构建 Tauri 应用成功
- 应用启动后 7 项功能路径可走通：选择目录 → 创建小说 → 生成大纲 → 生成章节 → 生成图片 → 导出 → 配置保存

---

## 11. 约束

### 11.1 P0 规则

| 规则 | 说明 |
|------|------|
| P0-1 | 锁定 Lucide React 作为唯一 SVG 图标库，禁止 emoji 图标 |
| P0-2 | 禁止紫色→粉色渐变方案，禁止紫色系背景 |
| P0-3 | 禁止 AI 模板味文案 |
| P0-4 | 禁止彩色左边框卡片强调 |
| P0-5 | 禁止渐变文字（background-clip: text + 渐变） |
| P0-6 | 禁止渐变进度条填充 |

### 11.2 代码约束

| 约束 | 说明 |
|------|------|
| IPC 单一入口 | 前端只能通过 `services/tauri.ts` 调用后端，禁止组件直接 `invoke()` |
| 类型同步 | 改 Rust serde 结构体须同步 `src/types/index.ts`；字段统一 camelCase |
| 文件写入 | 一律用 `write_file_atomic`，勿裸写 |
| AI 调用 | 内置 3 次重试 + 指数退避 |
| Rust 文件 | ≤ 300 行 |
| React 组件 | ≤ 200 行 |
| TS 配置 | strict + noUnusedLocals + noUnusedParameters |
| Vite 端口 | strictPort: 1422 |

### 11.3 Git 约定

- 提交格式：`<type>(<scope>): <中文描述>`，描述 ≤ 50 字
- type：`feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert`
- 严禁 AI 生成标记（Co-Authored-By: Claude、Generated with Claude、🤖 等）

---

## 12. 已知坑与风险

### 12.1 Lucide React 版本号

原项目 `package.json` 中 `lucide-react: "^1.31.0"` 不存在于 npm registry。lucide-react 使用 `0.x` 版本系列。重构时修正为 `^0.460.0`。

### 12.2 Tailwind v4 + shadcn/ui 配置

- Tailwind v4 不使用 `tailwind.config.ts`，改用 CSS 内 `@theme` 指令
- `components.json` 中 `"config"` 字段必须为空字符串
- 删除 `tailwind.config.ts`（如存在）
- 使用 `@tailwindcss/vite` 插件，不用 PostCSS
- 动画库从 `tailwindcss-animate` 换成 `tw-animate-css`（v4 兼容）

### 12.3 Tauri v2 Capabilities 配置

需确保 `src-tauri/capabilities/` 下的配置文件包含：
- `core:default` — 基础 API
- `dialog:default` — 文件对话框
- `protocol-asset` — 图片资源协议

### 12.4 react-router-dom v7

包名从 `react-router-dom` 改为 `react-router`（但 `react-router-dom` 仍作为兼容包可用）。保持 `react-router-dom` 包名不变，v7 的 `react-router-dom` 是 `react-router` 的超集，API 兼容。

### 12.5 Zustand v5 create() 语法

TypeScript 中使用 middleware 时需要双括号 `create<Store>()(...)`。不使用 middleware 时单括号 `create<Store>(...)`。

### 12.6 字体离线打包

Tauri 应用无法依赖 CDN 加载字体（离线场景）。需将 woff2 字体文件打包到 `src/assets/fonts/` 并通过 `@font-face` 本地引用。

### 12.7 image.rs UTF-8 截断 bug

原项目 `content[:3000]` 按字节截断可能导致 UTF-8 字符断裂。重构时改为按字符截断 `content.chars().take(3000).collect()`。

### 12.8 memory.rs JSON 解析

原项目用正则提取 JSON，对模型输出格式依赖强。重构时保持此逻辑但增强容错（尝试多种 JSON 提取策略）。

### 12.9 Tauri 事件名一致性

后端 emit 的事件名与前端 listen 的事件名必须完全一致。新增/修改事件时以 `services/tauri.ts` 和后端 emit 实测为准。

### 12.10 TS 严格模式遗留

TS 配置为 `strict` + `noUnusedLocals` + `noUnusedParameters`，遗留未用变量会导致 `npm run build` 失败。重构时需清理所有未使用变量。

---

## 13. 端到端验证步骤

### 13.1 前端验证

```bash
cd /Volumes/base/project/AutoWrite-refactor/app
npm install
npx shadcn@latest init
npx shadcn@latest add button card input textarea select progress dialog tabs tooltip sonner sidebar scroll-area alert-dialog badge collapsible skeleton form
npm run dev          # 启动开发服务器，确认页面渲染正常
npm run lint         # ESLint 检查
npm run build        # tsc + vite build 确认构建通过
```

### 13.2 后端验证

```bash
cd /Volumes/base/project/AutoWrite-refactor/app/src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build
```

### 13.3 集成验证

```bash
cd /Volumes/base/project/AutoWrite-refactor/app
npm run tauri:build
# 启动应用后验证：
# 1. 选择小说目录 → 目录路径正确显示
# 2. 创建小说 → novel.md 文件生成
# 3. 生成大纲 → 流式输出正常，世界观/角色/章节大纲三步骤完成
# 4. 生成章节 → 流式输出正常，章节文件写入 chapters/
# 5. 生成图片 → ModelScope 轮询正常，图片下载到 images/
# 6. 导出 → Markdown/TXT/DOCX/PDF 导出正常
# 7. 设置 → 配置保存到 config.yaml，重启后加载正常
```

### 13.4 视觉验证

- 确认所有页面无紫色背景
- 确认进度条为纯色填充（无渐变）
- 确认无 emoji 图标
- 确认所有颜色通过 CSS 变量引用（无硬编码 hex）
- 确认 `prefers-reduced-motion` 下动效正确降级

---

## 14. ADR 架构决策记录摘要

| ADR | 决策 | 状态 |
|-----|------|------|
| ADR-001 | 使用 shadcn/ui + Tailwind CSS v4 | Accepted |
| ADR-002 | 使用 Zustand v5 替代 Redux Toolkit | Accepted |
| ADR-003 | 锁定 Lucide React `^0.460.0` 为唯一图标库 | Accepted |
| ADR-004 | 引入 AiProvider trait 抽象 AI 调用层 | Accepted |
| ADR-005 | MVP 阶段维持手写 TS 类型，暂不引入 tauri-specta | Accepted |
| ADR-006 | 拆分 services/image.rs 为多文件模块 | Accepted |
| ADR-007 | 引入 dto/ 模块分离 IPC DTO 与领域类型 | Accepted |

---

## 15. 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-11 | v1.0 | 初始生成，基于 PRD-v1 + technical-architecture-v1 + design-direction-v1 |

### 关键决策记录

1. **色彩方案**：以设计师文档（design-direction-v1）为准，采用暖炭黑 + 琥珀色方案。架构文档 3.5 节中保留的紫色 CSS 变量值已被本 Spec 覆盖，不作为实现依据。
2. **命令数量**：经核实 lib.rs invoke_handler，确认为 25 个命令。
3. **字体方案**：新增 react-hook-form + zod + @hookform/resolvers 用于表单验证（架构文档未列出，但 shadcn/ui Form 需要这些依赖）。
4. **Sonner**：新增 sonner ^2.0.0 作为 Toast 通知库（shadcn/ui 推荐，替代 antd message）。
