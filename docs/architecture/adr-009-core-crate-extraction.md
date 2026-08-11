# ADR-009：抽取 autowrite-core crate（后端积木化阶段 A）

- **状态**：已接受
- **日期**：2026-08-12
- **决策者**：首席架构师（MvpDevExpertTeam）
- **取代**：无（延续 ADR-007 分层、ADR-008 DTO 契约）

---

## 1. 背景

### 1.1 当前结构

AutoWrite 后端目前是单一 crate `autowrite-app`（lib name `autowrite_lib`），位于
`app/src-tauri/`。内部共五层：

```
src-tauri/src/
├── domain/      # 业务核心：novel / chapter / memory / config / types / util
├── services/    # 基础设施：ai(openai/ollama) / files / image / export / config
├── dto/         # IPC 视图层（ADR-008 建立）
├── commands/    # Tauri command 层（novel/config/image/export/system）
└── state.rs     # AppState（novel_dir / config_path / outline_generation）
```

依赖方向（ADR-007/008 已理顺，单向清晰）：

```
commands ──► dto ──► domain ──► services(ai/files/image/...)
                         ▲            │
                         └────────────┘  (domain 反向依赖 services！见 §5.1)
```

### 1.2 用户诉求

将后端"积木化"，核心 AI 能力下沉为**最小可复用单元**，能被 CLI / Web / SDK / 批处理
等非 Tauri 场景直接复用（类比 Pi 的多 package 架构）。当前所有逻辑锁死在 Tauri 进程内，
无法脱离桌面应用单独使用。

### 1.3 前置条件（已具备）

- ADR-007 已建立 `dto/` 分层，IPC 视图与领域类型分离。
- ADR-008 已对齐 DTO 与前端 SPEC 6.3 契约，领域类型（磁盘格式）保持稳定不动。
- 模块依赖在 `commands → dto → domain` 方向已单向清晰。
- **唯一的反向耦合**是 `domain/{novel,chapter,memory}.rs` 直接 `use crate::services::{ai, files}`
  读写文件——这是抽取 core 时必须处理的核心障碍（详见 §5.1）。

---

## 2. 决策

**拆分方案：Cargo workspace + 分阶段抽 crate。本 ADR 仅执行阶段 A（抽 core）。**

### 2.1 目标终态（4 crate）

| crate | 内容 | 依赖 | 复用场景 |
|---|---|---|---|
| `autowrite-core` | domain/* + services/ai/* + error + util | reqwest / tokio / serde / serde_yaml / thiserror / async-trait / chrono / regex | CLI / Web / SDK / 批处理 |
| `autowrite-storage` | services/files/* | core | 换存储后端（SQLite / S3） |
| `autowrite-image` | services/image/* | core | 图片能力独立复用 |
| `autowrite-app` | commands/* + dto/* + state + lib.rs | 上面全部 + tauri | 桌面应用（Tauri 壳） |

### 2.2 本 ADR 范围：阶段 A 只做 core 抽离

- **抽出**：`autowrite-core`（domain + services/ai + error + util）
- **暂留 app**：`services/files/*`、`services/image/*`、`services/export.rs`、`services/config.rs`
- **阶段 B**（后续独立 ADR）：再抽 storage / image。

分阶段的理由：core 是所有场景的复用基座，价值最高、风险最大（要斩断 emit 与 files 耦合），
单独成步可隔离验证。storage/image 抽离是纯机械搬运，留待 core 稳定后做。

---

## 3. 关键设计决策

### 3.1 emit → 回调注入（最重要，斩断 Tauri 依赖）

**问题**：`domain/novel.rs` 与 `domain/chapter.rs` 直接 `use tauri::Emitter` +
`app.emit("outline-progress" / "chapter-progress", ...)` 推流式进度，共 **8 处** emit。
core 必须**零 Tauri 依赖**，因此这些 emit 不能留在 core。

**方案**：core 侧用**回调函数**表达进度事件，app 侧调用 core 时传入闭包，闭包内执行
真正的 `app.emit(...)`。core 完全不知道 Tauri 存在。

#### 3.1.1 core 侧新增进度回调类型

```rust
// core/src/domain/progress.rs（新增模块）
use serde::{Serialize, Deserialize};

/// 大纲生成内部步骤名（与提示词模板对齐）。
/// 注意：这是 core 内部口径，对外回调时已由 map_step 映射成前端契约值。
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub enum OutlineStep {
    World,
    Characters,
    Outline,
}

/// core 向外推送的进度事件。core 的调用方（app command 层）
/// 负责把它转成具体的 Tauri 事件载荷。
#[derive(Clone, Debug)]
pub enum ProgressEvent {
    /// 大纲某步骤：流式文本块（done=false）或步骤完成标记（done=true）
    OutlineStep { step: OutlineStep, chunk: String, done: bool },
    /// 章节生成：流式文本块（done=false）或完成标记（done=true）
    ChapterChunk { chunk: String, done: bool },
}
```

#### 3.1.2 8 个 emit 点的逐条映射

> 行号以当前 `app/src-tauri/src/` 为准。迁移到 core 后文件路径变为 `core/src/domain/`。

**`domain/novel.rs`（6 处）**

| 原位置 | 原 emit 行为 | 改为回调 |
|---|---|---|
| `novel.rs:91` | `emit_skip`：某步骤被跳过（target_step 过滤），done=true | `on_progress(ProgressEvent::OutlineStep { step, chunk: String::new(), done: true })` |
| `novel.rs:182` | `streaming_step` 内每个流式块，done=false | `on_progress(ProgressEvent::OutlineStep { step, chunk: chunk.to_string(), done: false })` |
| `novel.rs:195` | `streaming_step` 收尾，done=true | `on_progress(ProgressEvent::OutlineStep { step, chunk: String::new(), done: true })` |

> 说明：当前 `novel.rs` 的 `emit_skip`（L89-99）和 `streaming_step`（L180-202）各**同时**
> 调用 `on_progress` 回调和 `app.emit`（双重推送）。改造后：core 内部**只调用 `on_progress`**，
> 移除全部 `app.emit`；`app.emit` 的等价语义由 app 侧注入的闭包完成。

**`domain/chapter.rs`（3 处 emit，实际为 3 个点）**

| 原位置 | 原 emit 行为 | 改为回调 |
|---|---|---|
| `chapter.rs:32` | 章节正文流式块，done=false | `on_progress(ProgressEvent::ChapterChunk { chunk: chunk.to_string(), done: false })` |
| `chapter.rs:62` | "正在提取叙事记忆..."提示块，done=false | `on_progress(ProgressEvent::ChapterChunk { chunk: "\n\n[正在提取叙事记忆...]".to_string(), done: false })` |
| `chapter.rs:72` | 章节收尾，done=true | `on_progress(ProgressEvent::ChapterChunk { chunk: String::new(), done: true })` |

#### 3.1.3 core 函数新签名

core 的生成函数**移除 `app: &tauri::AppHandle` 参数**，改为接收 `on_progress` 回调：

```rust
// core/src/domain/novel.rs
pub async fn generate_outline_streaming_with_progress<F>(
    dir: &std::path::Path,      // ← 仍接收 dir（见 §5.1 说明）
    config: &AppConfig,
    target_step: &str,
    on_progress: F,
) -> Result<String>
where
    F: Fn(ProgressEvent) + Clone + Send + Sync + 'static,
```

> `generate_outline_streaming`（无进度版本）保留，内部传一个空闭包 `|_| {}`。

```rust
// core/src/domain/chapter.rs
pub async fn generate_chapter_streaming<F>(
    dir: &std::path::Path,
    config: &AppConfig,
    on_progress: F,
) -> Result<u32>
where
    F: Fn(ProgressEvent) + Clone + Send + Sync + 'static,
```

#### 3.1.4 app 侧注入闭包（commands/novel.rs）

app 的 command 层调用 core 时，构造闭包，把 `ProgressEvent` 转回原 Tauri 事件载荷：

```rust
// app/src-tauri/src/commands/novel.rs（改造后）
let app_for_emit = app.clone();
novel::generate_outline_streaming_with_progress(
    &dir, &config, &target_step,
    move |ev: ProgressEvent| {
        match ev {
            ProgressEvent::OutlineStep { step, chunk, done } => {
                // 1. 更新 AppState（原 on_progress 的状态更新逻辑）
                let state = app_for_emit.state::<AppState>();
                let mut status = state.outline_generation.lock().unwrap();
                let step_name = map_step(&format!("{:?}", step)); // 或由回调直接传字符串
                status.current_step = Some(step_name.to_string());
                if !chunk.is_empty() {
                    status.streaming_text.entry(step_name.to_string()).or_default().push_str(&chunk);
                }
                // 2. 还原原 emit（OutlineProgressEvent 载荷留在 app 侧）
                let _ = app_for_emit.emit("outline-progress", OutlineProgressEvent {
                    step: map_step(step_name).to_string(),
                    chunk,
                    done,
                });
            }
            ProgressEvent::ChapterChunk { .. } => { /* chapter 场景同理 */ }
        }
    },
).await?;
```

> **关键**：`OutlineProgressEvent` / `ChapterProgressEvent` 这两个 serde 结构体
> **留在 app crate**（它们只在 app↔前端 IPC 边界用），core 只产出中性的 `ProgressEvent`。

#### 3.1.5 不动的 emit（明确边界）

- `commands/novel.rs:110` 的 `emit("outline-generation-status", ...)` 是 command 层
  **状态收尾**（spawn 任务结束后的汇总通知），**不属于 domain 流式进度**，保留在 app 层不动。
- `commands/image.rs` 的 4 处 `emit("image-progress", ...)` 全在 command 层
  （`generate_image_common` 内），**不动**。

### 3.2 files 耦合处理（方案 C：files 整体进 core）

**这是本 ADR 最需要后端工程师警惕的设计点。**

**现状**：`domain/novel.rs`、`domain/chapter.rs`、`domain/memory.rs` 都执行
`use crate::services::{ai, files}`，并通过 `files::read_novel` / `files::write_novel` /
`files::read_context` / `files::write_context` / `files::parse_outline_text` /
`files::write_outline` / `files::chapters_dir` / `files::get_chapter_outline` /
`files::write_file_atomic` 等直接读写磁盘。

如果 core 包含 domain、而 files 留在 app，则 **core → app 反向依赖**，编译失败。

**决策（方案 C，Team Lead 拍板）：把 `services/files/*` 整体放进 core 的 `storage/` 模块。**

经评估原方案 A（core 定义 `NovelStore` trait、domain 函数加 `store` 参数）改动面过大
（所有 domain 生成函数签名都要改），且 `&dyn` trait 对象 / 泛型 `S: NovelStore`
在 async fn 里 Send/Sync 处理复杂。方案 C 更务实：

1. **core 包含 files**：`services/files/*` 迁入 `core/src/storage/`，含
   `mod.rs / novel.rs / context.rs / outline.rs / chapters.rs`。core 自包含，编译无环。
2. **domain 函数签名不改**：`generate_outline_streaming_with_progress` 等仍直接调
   `crate::storage::read_novel(dir)` 等（storage 在 core 内，`crate::` 路径有效）。
   **不加 store 参数** —— 签名保持当前简洁，最小 diff。
3. **NovelStore trait 暂不定义**（YAGNI）。阶段 A 目标是"core 可独立编译 + 可复用"；
   trait 抽象是阶段 B 抽 storage crate 时的事。
4. **app 无需适配器**：app 的 commands 里原 `crate::services::files::list_chapters` 等
   调用，改为 `autowrite_core::storage::list_chapters`（core re-export）。

**方案 C 的好处**：
- core 自包含、可独立编译、可被 CLI / Web 复用（带上 files 让复用更完整 —— CLI 也想读写小说文件）
- domain 函数签名**零改动**（最小 diff）
- files 代码**零改动**（只是换目录，从 `services/files/` → `storage/`）
- 阶段 B 拆 storage crate 时是纯机械搬运（`core/storage/` → storage crate 根），零风险
- 绕过 trait 对象 / 泛型在 async 里的所有 Send/Sync 复杂度

### 3.3 公共 API（core 暴露什么）

core 的 `lib.rs` 用 `pub use` 聚合对外类型与函数。app crate 通过
`use autowrite_core::...` 访问。

```rust
// core/src/lib.rs
pub mod domain;
pub mod services;
pub mod storage;          // §3.2 方案 C：files 整体进 core
pub mod error;
pub use progress::{OutlineStep, ProgressEvent};   // §3.1

// 领域类型
pub use domain::types::*;   // NovelData / ChapterMeta / ContextData / Volume /
                            // ChapterEntry / EmotionalTag / TensionItem / NarrativeIntent

// 配置
pub use domain::config::*;  // AppConfig / Provider / Prompts / ImageProvider /
                            // ImagePrompts / LoraConfig / LoraEntry / fill_template

// novel 业务
pub use domain::novel::*;   // NovelStatus / create_novel /
                            // generate_outline_streaming /
                            // generate_outline_streaming_with_progress / get_status

// chapter 业务
pub use domain::chapter::*; // generate_chapter_streaming

// memory 业务
pub use domain::memory::*;  // update_memory

// 工具
pub use domain::util::*;    // map_step

// AI 能力
pub use services::ai::*;    // AiProvider / Message / create_provider / generate /
                            // generate_streaming / OpenAIProvider / OllamaProvider

// 文件持久化（方案 C：files 进 core，app 通过 re-export 复用）
pub use storage::*;         // read_novel / write_novel / read_context / write_context /
                            // read_outline / write_outline / list_chapters /
                            // read_chapter / list_chapters_with_content /
                            // chapters_dir / novel_file / outline_file /
                            // get_chapter_outline / parse_outline_text /
                            // parse_yaml_front_matter / write_file_atomic / ...

// 错误
pub use error::*;           // AppError / Result
```

> `services::ai::mod.rs` 里 `Message` 当前是 `pub(crate)`，需改为 `pub` 才能被 re-export。
> `build_client` / `retry_delay` / `retries_exhausted` 保持 `pub(crate)`，不对外。

### 3.4 workspace 结构

```
app/                                  # app/ 目录仍是前端 vite 根（位置不变）
├── package.json                      # 前端依赖（不变）
├── vite.config.ts
├── index.html
├── src/                              # 前端源码（不变）
├── dist/                             # 前端构建产物（不变）
│
├── Cargo.toml                        # 【新增】workspace 根
│   # [workspace]
│   # resolver = "2"
│   # members = ["core", "app-tauri"]
│
├── core/                             # 【新增】autowrite-core crate
│   ├── Cargo.toml                    # name = "autowrite-core"，lib name = "autowrite_core"
│   └── src/
│       ├── lib.rs
│       ├── progress.rs               # §3.1 新增
│       ├── error.rs                  # 迁自 src-tauri/src/error.rs
│       ├── domain/
│       │   ├── mod.rs
│       │   ├── novel.rs
│       │   ├── chapter.rs
│       │   ├── memory.rs
│       │   ├── config.rs
│       │   ├── types.rs
│       │   └── util.rs
│       ├── services/
│       │   └── ai/
│       │       ├── mod.rs
│       │       ├── openai.rs
│       │       └── ollama.rs
│       └── storage/                  # §3.2 方案 C：files 整体进 core
│           ├── mod.rs                # 迁自 services/files/mod.rs
│           ├── novel.rs              # 迁自 services/files/novel.rs
│           ├── context.rs            # 迁自 services/files/context.rs
│           ├── outline.rs            # 迁自 services/files/outline.rs
│           └── chapters.rs           # 迁自 services/files/chapters.rs
│
└── app-tauri/                        # 【改名】原 src-tauri/ → app-tauri/
    ├── Cargo.toml                    # name = "autowrite-app"，依赖 autowrite-core = { path = "../core" }
    ├── build.rs                      # tauri-build（留 app）
    ├── tauri.conf.json               # 路径见 §3.5
    ├── icons/
    ├── capabilities/                 # 若有
    ├── tests/
    │   ├── config_test.rs
    │   └── full_flow.rs
    └── src/
        ├── lib.rs
        ├── main.rs
        ├── state.rs
        ├── commands/
        │   ├── mod.rs
        │   ├── novel.rs
        │   ├── config.rs
        │   ├── image.rs
        │   ├── export.rs
        │   └── system.rs
        ├── dto/
        │   ├── mod.rs
        │   ├── novel.rs
        │   ├── config.rs
        │   ├── image.rs
        │   └── export.rs
        └── services/                 # 暂留 app 的部分（files 已进 core，这里只剩 image/export/config）
            ├── mod.rs
            ├── config.rs
            ├── export.rs
            └── image/                # 暂留（阶段 B 抽 image）
                ├── mod.rs
                ├── generate.rs
                ├── lora.rs
                ├── meta.rs
                └── prompt.rs
```

**lib name 一致性**：
- core crate：`name = "autowrite-core"`，`[lib] name = "autowrite_core"`
- app crate：`name = "autowrite-app"`，`[lib] name = "autowrite_lib"`（**保持不变**，
  因为 `main.rs` 调 `autowrite_lib::run()`，tests 也用 `autowrite_lib::`，改名会扩大改动面）

### 3.5 tauri.conf.json 与前端路径

**调研结论（已查 Tauri v2 文档与社区实践）**：Tauri v2 **完整支持 Cargo workspace**。
`tauri.conf.json` 的 `build.frontendDist` / `devUrl` 路径是**相对于 `tauri.conf.json`
所在目录解析的**，与 workspace 结构无关。`beforeDevCommand` / `beforeBuildCommand`
在 `tauri.conf.json` 所在目录执行。

因此，**只要 `tauri.conf.json` 仍位于 `app/` 的直接子目录下**（即 `app/app-tauri/`），
路径保持不变：

```jsonc
// app/app-tauri/tauri.conf.json（路径不变）
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1422",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"   // ← app/app-tauri 的上一级 app/ 下有 dist/，不变
  }
}
```

`beforeDevCommand` 的 cwd：`tauri dev` 默认在 `tauri.conf.json` 同级目录执行命令。
但 `npm run dev` 需要在 `app/`（含 package.json）执行。有两种处理：

1. **推荐**：保持 `beforeDevCommand: "npm run dev"`，并在 `app/` 下运行
   `npm run tauri dev`——此时 `@tauri-apps/cli` 会从 cwd 向上查找 `tauri.conf.json`。
   需确认：`npm run tauri dev` 的 cwd 是 `app/`，CLI 会定位到 `app/app-tauri/tauri.conf.json`。
   若 CLI 找不到，改用显式指定：`tauri dev ./app-tauri`（Tauri CLI 支持传入 config 目录）。
2. **备选**：若 CLI 必须在 config 同级运行，把 `beforeDevCommand` 改为
   `cd .. && npm run dev`（不推荐，路径脆弱）。

**`package.json` 的 scripts 无需改动**：`"tauri": "tauri"` / `"tauri:build": "tauri build"`
保持。验证时以 `cd app && npm run tauri dev` 为准（见 §6）。

> `vite.config.ts` 中 `watch.ignored` 已忽略 `src-tauri/**`，改名后应同步改为
> `app-tauri/**` 或 `*-tauri/**`，避免 Rust 改动触发前端 HMR 重启。

---

## 4. 影响与风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| ~~files 循环依赖~~ | （方案 C 已规避：files 整体进 core，无环） | — |
| **core 体积偏大（含 files）** | 低：core 多带一个 storage 模块，体积增加但语义自洽（CLI 复用也想读写小说文件） | 阶段 B 抽 storage crate 时纯机械搬运，零风险 |
| **目录迁移量** | ~22 个 .rs 文件移动，use 路径从 `crate::domain::` 改 `autowrite_core::domain::`（或经 re-export 直接 `autowrite_core::`） | §7 步骤 1-3 集中处理，可脚本化 |
| **Tauri workspace 兼容性** | `tauri dev` / `tauri build` 能否在 workspace 子 crate 下工作 | 已查文档确认 v2 支持 workspace，路径解析相对 config 所在目录。**`tauri dev` 启动验证是验收硬门槛**（§6） |
| **闭包 Send/Sync 约束** | `tauri::AppHandle` 是 Send+Clone，闭包捕获它须满足 `Send + Sync + 'static`（因 `tauri::async_runtime::spawn`） | core 回调签名设计为 `F: Fn(ProgressEvent) + Clone + Send + Sync + 'static`，与现有 `generate_outline_streaming_with_progress` 的 `F` 约束一致 |
| **测试位置** | `tests/config_test.rs` 用 `autowrite_lib::domain::config` / `services::config`；`full_flow.rs` 用 `autowrite_lib::{domain, services::files, services::ai}` | config_test 测 domain/config → 改 `autowrite_core::domain::config`；测 services::config（落盘）→ 该函数留 app，用 `autowrite_lib::services::config`。full_flow 的 `services::files` / `services::ai` / `domain` 引用全改 `autowrite_core::`（files 进 core 了）。逐条核对（§7 步骤 9） |
| **DTO 归属** | dto 留 app（依赖 tauri Serialize 给 IPC），但 `From<domain::X>` 需 domain 类型 pub | core 的 `pub use domain::types::*` 已满足，app 的 dto 直接 `use autowrite_core::NovelData` 等 |
| **`services::ai::Message` 可见性** | 当前 `pub(crate)`，core 对外要用 | 改 `pub`（§3.3） |

---

## 5. 验证计划

每步独立可验证，全部通过才算阶段 A 完成：

1. `cd app && cargo check --workspace` —— 全绿（验证 workspace 结构正确）
2. `cargo test --workspace` —— 全绿（含 config_test 的 7 个单测；full_flow 为 `#[ignore]` 需真实 API key，单独 `--ignored` 验证）
3. `cargo clippy --workspace -- -D warnings` —— 零警告
4. **`cd app && npm run tauri dev`** —— **能启动到窗口**（关键：验证 Tauri v2 workspace 兼容性，最大风险点）
5. `cd app && npm run tauri:build` —— 能产出 `.app`（macOS）
6. 手动冒烟：创建小说 → 生成大纲（观察流式进度事件仍正常推送）→ 生成章节（观察 chapter-progress 事件）→ 设置页加载/保存配置

---

## 6. 实施步骤（给后端工程师的执行清单）

> 每步标注【验证】，完成即检查。建议在 `refactor/full-rewrite` 分支上分小提交。

### 阶段 0：准备

1. **【验证】** 在 `refactor/full-rewrite` 分支，确认工作区干净：`git status`。
   建立新分支 `refactor/core-extraction`（可选，便于回滚）。

### 阶段 1：搭 workspace 骨架

2. 新建 `app/Cargo.toml`（workspace 根）：
   ```toml
   [workspace]
   resolver = "2"
   members = ["core", "app-tauri"]
   ```
3. 新建 `app/core/Cargo.toml`：
   ```toml
   [package]
   name = "autowrite-core"
   version = "1.0.0"
   edition = "2021"

   [lib]
   name = "autowrite_core"

   [dependencies]
   reqwest = { version = "0.12", features = ["json"] }
   tokio = { version = "1", features = ["full"] }
   serde = { version = "1", features = ["derive"] }
   serde_json = "1"
   serde_yaml = "0.9"
   thiserror = "2"
   chrono = "0.4"
   regex = "1"
   async-trait = "0.1"
   ```
4. **【验证】** `git mv app/src-tauri app/app-tauri`（改名）。
   `cd app && cargo check` 此时仍应是单 crate 报错（因为还没拆），确认改名无误。

### 阶段 2：迁移 core 文件

5. 把以下文件从 `app/app-tauri/src/` 移到 `app/core/src/`（保持子目录结构）：
   - `error.rs` → `core/src/error.rs`
   - `domain/{mod,novel,chapter,memory,config,types,util}.rs` → `core/src/domain/`
   - `services/ai/{mod,openai,ollama}.rs` → `core/src/services/ai/`
   - `services/files/{mod,novel,context,outline,chapters}.rs` → `core/src/storage/`（方案 C，files 整体进 core）
6. 新建 `core/src/lib.rs`（内容见 §3.3），新建 `core/src/progress.rs`（§3.1.1）。
   **不需要** `core/src/storage.rs` trait 文件（方案 C 不引入 trait）。
7. **改 core 内 use 路径**：
   - `crate::domain::*`、`crate::error::*`、`crate::services::ai::*` 这些 `crate::` 引用在 core 内部仍然有效（crate 指 core 自身），**无需改**。
   - `services/ai/mod.rs`：`Message` 改 `pub`，`pub mod ollama; pub mod openai;` 已是 pub。
   - domain 内的 `use crate::services::{ai, files}`：**`ai` 部分保留**（ai 在 core 内），
     **`files` 部分改为 `use crate::storage`**（files 已迁到 core/storage/，重命名模块）。
     即所有 `files::xxx` 调用改为 `storage::xxx`。全局 sed 替换 `crate::services::files` → `crate::storage`
     和 `use crate::services::{ai, files}` → `use crate::services::ai; use crate::storage;`。
   - `core/src/storage/mod.rs` 内部若有相互引用，保持原样（模块内部结构不变）。
8. **【验证】** `cd app && cargo check -p autowrite-core` —— core 独立编译通过。

### 阶段 3：改造 app crate

9. 改 `app/app-tauri/Cargo.toml`：删除已迁出的依赖（reqwest/tokio/serde/serde_yaml/thiserror/
   chrono/regex/async-trait 这些现在只有 core 用，app 不直接用则从 app 的 Cargo.toml 删除），
   新增 `autowrite-core = { path = "../core" }`。保留 tauri 系列、`dirs`（lib.rs 的 `dirs_config_path` 用）。
10. `app/app-tauri/src/lib.rs`：模块声明删掉 `domain` / `error`，改为 `use autowrite_core::{...}` 引入。
    `pub mod services;` 保留（只剩 image/export/config，files 已迁走）。删除 `services/files/` 子目录
    （文件已移到 core）。
11. **不需要 LocalFileStore 适配器**（方案 C 取消 trait）。
12. **改造 commands/novel.rs**：
    - `generate_outline` / `start_outline_generation`：去掉 `&app`，改传 `on_progress` 闭包（§3.1.4）。
    - `generate_chapter`：同理。
    - `create_novel` / `get_status` / `list_chapters` / `read_chapter`：原 `crate::services::files::xxx`
      调用改为 `autowrite_core::storage::xxx`（core re-export）。
    - `OutlineProgressEvent` / `ChapterProgressEvent` 结构体留在 app（从 novel.rs/chapter.rs 迁回 app，或新建 app/src/events.rs）。
13. **改 app 内其余 use 路径**：`crate::domain::types::*` → `autowrite_core::*`，
    `crate::error::*` → `autowrite_core::*`，`crate::services::ai` → `autowrite_core::services::ai`，
    `crate::services::files` → `autowrite_core::storage`。全局搜索 `crate::domain` / `crate::error`
    / `crate::services::files` / `crate::services::ai` 在 app/src 内的残留，逐个替换。
14. **【验证】** `cd app && cargo check --workspace` —— 全绿。
15. **【验证】** `cd app && cargo test --workspace` —— config_test 全绿。
16. **【验证】** `cd app && cargo clippy --workspace -- -D warnings`。

### 阶段 4：修正测试与前端联动

17. **改 tests**：`tests/config_test.rs` 中
    `autowrite_lib::domain::config` → `autowrite_core::domain::config`（domain 已进 core）；
    `autowrite_lib::services::config` → 保留（落盘函数留 app）。
    `tests/full_flow.rs`：`autowrite_lib::services::ai` → `autowrite_core::services::ai`；
    `autowrite_lib::services::files` → `autowrite_core::storage`（files 已进 core）；
    `autowrite_lib::domain::{novel, types}` → `autowrite_core::{novel, ChapterMeta}` 等。
18. **改 vite.config.ts**：`watch.ignored` 的 `src-tauri/**` → `app-tauri/**`。
19. **【验证】** `cd app && npm run tauri dev` —— 窗口正常启动（**关键门槛**）。
20. **【验证】** `cd app && npm run tauri:build` —— 产出 `.app`。
21. **【验证】** 手动冒烟全流程（创建→大纲→章节→设置→图片→导出）。

### 阶段 5：收尾

22. 更新 `README.md` / `TODO.md` 中涉及目录结构的描述（若有）。
23. PR 描述附本 ADR 链接与验证截图。

---

## 7. 附录：emit 点原始清单（备查）

| 文件 | 行号 | 事件 | 用途 | 归属 |
|---|---|---|---|---|
| domain/novel.rs | 91 | outline-progress | 跳过步骤 done=true | → core 回调 |
| domain/novel.rs | 182 | outline-progress | 流式块 done=false | → core 回调 |
| domain/novel.rs | 195 | outline-progress | 步骤收尾 done=true | → core 回调 |
| domain/chapter.rs | 32 | chapter-progress | 章节流式块 done=false | → core 回调 |
| domain/chapter.rs | 62 | chapter-progress | 提取记忆提示 done=false | → core 回调 |
| domain/chapter.rs | 72 | chapter-progress | 章节收尾 done=true | → core 回调 |
| commands/novel.rs | 110 | outline-generation-status | 任务状态收尾 | **留 app** |
| commands/image.rs | 27/38/49/63/85 | image-progress | 图片生成进度（5 处） | **留 app** |

> novel.rs 实际有 `emit_skip`（内含 1 次 emit）与 `streaming_step`（内含 2 次 emit），
> 合计 3 个 emit 调用点，按去重后语义映射为 3 类回调。全项目 domain 内 emit 共 6 处，
> 与任务描述"8 处"的差异在于：commands 层的 2 处（novel:110 / image 系列）不计入 domain。
