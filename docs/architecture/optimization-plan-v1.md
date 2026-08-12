# AutoWrite 架构优化方案 v1

## 概述

- **审计时间**：2026-08-12
- **审计范围**：后端三 crate（core / app-tauri / cli）+ 前端 React 19 + 构建/CI/测试全链路
- **审计方法**：逐文件 Read 全部 ~40 个源码文件，对照 SPEC.md / ADR-008 / ADR-009 交叉验证
- **当前架构一句话总结**：重构后结构清晰——core 零 Tauri 依赖可复用，app-tauri 负责装配与 IPC，cli 证明 core 独立价值；DTO 层与前端契约对齐良好，批量并发设计到位
- **优化点统计**：共识别 **23 个优化点**，分布为 P0×4、P1×8、P2×7、P3×4

## 优先级分类

- **P0（紧急/高价值）**：4 项——CI 配置与实际目录不匹配导致后端 CI 完全失效；memory.rs UTF-8 截断 panic 风险；路径穿越安全隐患；config 保存非原子写入损坏风险
- **P1（重要）**：8 项——显著改善健壮性、可维护性或扩展性的问题
- **P2（增强）**：7 项——锦上添花，提升体验或开发效率
- **P3（远期）**：4 项——长期规划方向

---

## 优化点详情

### [P0-1] CI 配置目录路径错误——后端 CI 完全失效

- **问题**：`.github/workflows/ci.yml` 后端 job 的工作目录和 rust-cache 配置全部指向 `app/src-tauri`，但 ADR-009 已将目录重命名为 `app/app-tauri`（workspace 根在 `app/Cargo.toml`）。
  - `ci.yml:29` `working-directory: app/src-tauri` ← 目录不存在
  - `ci.yml:39` `workspaces: app/src-tauri` ← rust-cache 指向错误路径
  - `ci.yml:40-41` `cargo clippy` / `cargo test` 在不存在的目录下执行，CI 必然失败
  - `release.yml:54` `projectPath: app` 缺少显式 `tsc` 配置目录参数
- **影响**：所有 PR / push 到 main 的后端 CI 红灯或静默跳过，clippy 警告无人拦截，回归风险高。release 流程的 tauri-action 可能找不到正确的 Cargo.toml。
- **方案**：
  ```yaml
  # ci.yml 后端 job 修正
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app          # workspace 根
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: app               # workspace 根，Cargo.toml 在此
      - run: cargo clippy --workspace --all-targets -- -D warnings
      - run: cargo test --workspace
  ```
  同时确认 `release.yml` 中 tauri-action 的 `projectPath: app` 能正确定位 `app/app-tauri/tauri.conf.json`（需实测验证）。
- **成本**：S（半天内）
- **风险**：无——纯配置修正

---

### [P0-2] memory.rs 字节截断 UTF-8 导致 panic

- **问题**：`core/src/domain/memory.rs:18` 使用字节切片截断章节正文：
  ```rust
  let truncated = &content[..content.len().min(3000)];
  ```
  中文字符占 3 字节（UTF-8），3000 字节处极大概率落在多字节字符中间，导致切片非字符边界。虽然 `&content[..n]` 本身不会 panic（字符串切片在非边界处会 panic），实际会在运行时触发 `byte index is not a char boundary` panic，使整个章节生成后的记忆提取崩溃——章节已写盘但记忆未更新。
- **影响**：用户每次生成章节时，如果正文超过 3000 字节（中文约 1000 字），记忆提取必定 panic，三层叙事记忆系统完全失效。这是核心业务流程上的致命缺陷。
- **方案**：与 `generate.rs:191` 的正确写法对齐：
  ```rust
  // memory.rs update_memory 内
  let truncated: String = content.chars().take(3000).collect();
  // 然后将 truncated 的引用传入 extract_* 函数
  if let Ok(facts) = extract_facts(config, &truncated).await { ... }
  ```
  注意当前代码后续传 `truncated` 给 `extract_facts(config, truncated)`（`&str`），改为 owned `String` 后传 `&truncated`。
- **成本**：S（1 小时）
- **风险**：无——纯 bug 修复，`generate.rs` 已验证相同模式可用

---

### [P0-3] 路径穿越（Path Traversal）安全漏洞

- **问题**：两个 IPC 命令直接用前端传入的 `filename` 拼接文件路径，未做规范化与边界检查：
  - `commands/novel.rs:238` `read_chapter(state, filename)` → `storage::read_chapter(&dir, &filename)` → `chapters_dir(dir).join(filename)`
  - `commands/image.rs:214` `get_image_path(state, filename)` → `images_dir(&dir).join(&filename)`
  - 如果前端（或恶意调用方）传入 `../../etc/passwd` 或 `../../../config.yaml`，可以读取 novel_dir 之外的任意文件。`get_image_path` 还会返回文件路径给前端用于 `convertFileSrc`，等于暴露任意文件路径。
  - SPEC.md §5.4 明确要求：「文件路径使用前必须规范化并验证位于 `novel_dir` 允许范围内」——此约束未实现。
- **影响**：本地优先桌面应用中，攻击面相对有限（用户自己的机器），但违反最小权限原则。若有任何 IPC 注入入口（浏览器扩展、恶意网页通过 Tauri 漏洞），则可读取敏感文件。
- **方案**：在 `commands/mod.rs` 新增路径校验函数：
  ```rust
  use std::path::{Path, PathBuf, Component};

  /// 校验 filename 不包含路径穿越组件，并确保 canonicalize 后在 base_dir 内。
  pub(crate) fn safe_join(base: &Path, filename: &str) -> Result<PathBuf> {
      let path = Path::new(filename);
      // 拒绝绝对路径、含 .. 的相对路径
      if path.components().any(|c| matches!(c, Component::ParentDir | Component::RootDir)) {
          return Err(AppError::Image(format!("非法文件名: {}", filename)));
      }
      let joined = base.join(filename);
      // canonicalize 防符号链接逃逸
      let canonical = joined.canonicalize()
          .map_err(|_| AppError::Image(format!("文件不存在: {}", filename)))?;
      let base_canonical = base.canonicalize()?;
      if !canonical.starts_with(&base_canonical) {
          return Err(AppError::Image("文件路径越界".to_string()));
      }
      Ok(canonical)
  }
  ```
  在 `read_chapter`、`get_image_path`、`delete_image` 等所有接受文件名的命令中调用。`storage::read_chapter` 也应加防御性检查。
- **成本**：S（半天）
- **风险**：低——canonicalize 对不存在文件会报错，需处理文件不存在场景的友好提示

---

### [P0-4] config.yaml 非原子写入——崩溃可损坏配置

- **问题**：`app-tauri/src/services/config.rs:15-18` 的 `save_config` 直接用 `std::fs::write`：
  ```rust
  pub fn save_config(path: &Path, config: &AppConfig) -> Result<()> {
      let content = serde_yaml::to_string(config)?;
      std::fs::write(path, content)?;   // ← 非原子，写入中途崩溃 = 文件截断损坏
      Ok(())
  }
  ```
  项目其他所有写文件操作都用 `storage::write_file_atomic`（先写 .tmp 再 rename，带 .bak 备份），唯独 config 没用。配置文件损坏会导致用户丢失所有 AI 配置（API Key、模型、提示词），体验极差。
- **影响**：用户保存配置时如果应用崩溃或系统断电，config.yaml 变成空文件或半截 YAML，下次启动加载失败。
- **方案**：改用 core 的 `write_file_atomic`：
  ```rust
  // services/config.rs
  use autowrite_core::storage::write_file_atomic;

  pub fn save_config(path: &Path, config: &AppConfig) -> Result<()> {
      let content = serde_yaml::to_string(config)?;
      write_file_atomic(path, &content)
  }
  ```
  同时在 `load_config` 中增加损坏容错：YAML 解析失败时返回默认值 + 日志告警（而非直接报错让前端白屏），参考 `cli/src/config_io.rs:19` 已有的 `unwrap_or_else(|_| AppConfig::default())` 模式。
- **成本**：S（1 小时）
- **风险**：无——core 的 `write_file_atomic` 已被全项目验证

---

### [P1-1] AppError 枚举缺少 Config 变体

- **问题**：`core/src/error.rs` 的 `AppError` 枚举比 SPEC.md §4.5 定义少了 `Config(String)` 变体。SPEC 定义了 13 个变体，实际只有 11 个。配置相关错误（如 YAML 解析失败）被笼统归入 `Yaml`，前端无法区分「配置文件损坏」和「novel.md 格式错误」，难以给出针对性提示。
- **影响**：错误信息不够精确，用户难以定位问题。
- **方案**：在 `error.rs` 补充：
  ```rust
  #[error("配置错误: {0}")]
  Config(String),
  ```
  在 `services/config.rs` 的 `load_config` 中，将 YAML 解析失败映射为 `AppError::Config` 而非 `AppError::Yaml`，附带恢复建议。
- **成本**：S（1 小时）
- **风险**：无

---

### [P1-2] list_chapters 命令与 storage 层逻辑重复

- **问题**：`commands/novel.rs:197-235` 的 `list_chapters` 命令完整复制了 `core/src/storage/chapters.rs:7-28` 的目录遍历 + YAML front matter 解析逻辑（~35 行），仅为注入 `filename` 字段。两份代码的解析逻辑需同步维护，一旦 storage 层改动（如加错误恢复），命令层不会自动跟进。
- **影响**：违反 DRY，维护成本翻倍，行为漂移风险。
- **方案**：在 `storage/chapters.rs` 新增返回文件名的版本：
  ```rust
  pub fn list_chapters_with_filenames(dir: &Path) -> Result<Vec<(ChapterMeta, String)>> {
      // 原有逻辑，同时收集 entry.file_name()
  }
  ```
  命令层改为调用此函数 + DTO 转换，消除重复遍历。同时 `list_chapters_with_content` 也可重构复用内部辅助函数。
- **成本**：S（半天）
- **风险**：低——纯重构，有测试覆盖

---

### [P1-3] AI 流式重试时提示文本混入章节正文

- **问题**：`core/src/services/ai/openai.rs:154-158` 和 `ollama.rs:125-129` 在流式重试时通过 `on_chunk` 回调推送重试提示文本：
  ```rust
  on_chunk(&format!("\n\n[服务端错误，正在重试 ({}/{})...]\n\n", attempt + 2, MAX_RETRIES))?;
  ```
  这个文本会通过 `generate_chapter_streaming` 的回调流向前端，同时——关键问题——**重试成功后，`full_text` 只包含实际 AI 输出（不含提示文本），但前端 UI 已经显示了这些提示文本**。前端 `novel-store.ts:64` 的 `appendStreamChunk` 会把提示文本拼进 `streamingText`，最终用户看到的流式预览含有多余的重试提示。虽然落盘文件正确（不含提示），但 UI 展示不一致。
- **影响**：用户体验——章节流式预览中出现「连接中断，正在重试...」文本，影响阅读体验。
- **方案**：两种选择（建议方案 A）：
  - **方案 A（推荐）**：将重试提示改为单独的进度通道。core 的 `ProgressEvent` 新增 `Warning(String)` 或 `Retry { attempt, max }` 变体，前端用 banner/Toast 展示而非拼入正文流。
  - **方案 B（最小改动）**：前端在 `onChapterProgress` 回调中过滤以 `\n\n[` 开头的 chunk（脆弱，不推荐）。
- **成本**：M（方案 A 需改 core + app + 前端三处）
- **风险**：低——增量改动，不影响现有逻辑

---

### [P1-4] context.md 读写用 Markdown 字符串匹配——脆弱且不可靠

- **问题**：`core/src/storage/context.rs` 将结构化的 `ContextData` 序列化为人类可读的 Markdown，然后通过字符串前缀匹配（`## 角色状态`、`- [ ]`）反序列化。这种「写 Markdown 再解析 Markdown」的方式存在严重可靠性问题：
  - `write_context`（L7-57）和 `read_context`（L59-150）是两套独立实现的逻辑，容易出现格式不对称
  - 角色 `character_states` 写入时格式化为人读文本（`- {name}：{location}，{power}，{action}`），读取时却推入 `serde_yaml::Value::String`——**信息丢失**（结构化的 name/location/power 变成一个字符串），`chapter.rs:98` 又试图从这个字符串重新提取字段（`s.get("name")`），但存的是字符串不是 map，永远匹配失败
  - AI 生成的 `character_states` 在 `memory.rs::merge_facts` 中以 `serde_yaml::to_value(ns)` 保存为结构化 map，但 `write_context` 又把它格式化为字符串——**往返丢失全部结构信息**
- **影响**：三层叙事记忆的「角色状态」字段在写入再读取后丢失结构化信息，`build_chapter_prompt` 中的角色状态展示逻辑实际无法正确工作（永远 fallback 到 `format!("- {:?}", s)` 打印原始 YAML 字符串），AI 看到的是噪音而非结构化角色信息。这直接影响章节生成质量。
- **方案**：将 context.md 改为「YAML front matter 存结构化数据 + Markdown 正文存人读摘要」的双层格式（与 novel.md 一致）：
  ```markdown
  ---
  current_chapter: 5
  character_states:
    - name: "张三"
      location: "京城"
      power_level: "筑基"
      status: "正常"
  plot_events:
    - "第一卷·初入江湖"
  ...
  ---
  # 上下文摘要
  ## 当前进度
  - 已完成：5章
  ```
  `write_context` 只写 front matter（结构化），Markdown 正文从 front matter 渲染（人读）。`read_context` 只解析 front matter。迁移策略：读取时先尝试解析 front matter，失败则 fallback 到旧的字符串匹配（兼容已有数据）。
- **成本**：M（需改 write/read 两端 + 迁移兼容，建议配合测试）
- **风险**：中——需保证对已有 context.md 的向后兼容

---

### [P1-5] workspace 依赖未集中管理——版本漂移风险

- **问题**：`app/core/Cargo.toml` 和 `app/app-tauri/Cargo.toml` 各自声明相同依赖但版本号重复：
  - `reqwest = { version = "0.12", features = ["json"] }` ×2
  - `tokio = { version = "1", features = ["full"] }` ×2
  - `serde`/`serde_json`/`serde_yaml`/`chrono` ×2
  
  Cargo 会自动统一到相同版本编译，但版本声明分散，未来升级需改多处，且 features 可能不一致（core 的 serde 用 derive，app-tauri 的也用 derive，但分散声明）。
- **影响**：维护成本——升级 reqwest 或 tokio 需改两个文件，易遗漏导致版本不一致警告。
- **方案**：在 `app/Cargo.toml`（workspace 根）添加 `[workspace.dependencies]`：
  ```toml
  [workspace.dependencies]
  reqwest = { version = "0.12", features = ["json"] }
  tokio = { version = "1", features = ["full"] }
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  serde_yaml = "0.9"
  chrono = "0.4"
  thiserror = "2"
  regex = "1"
  async-trait = "0.1"
  ```
  各 crate 改为 `reqwest.workspace = true`。后续升级只改一处。
- **成本**：S（2 小时）
- **风险**：无——纯 Cargo 配置优化

---

### [P1-6] openai.rs 与 ollama.rs 流式重试逻辑高度重复

- **问题**：`openai.rs`（236 行）和 `ollama.rs`（189 行）的 `generate` 和 `generate_streaming` 方法中，重试循环结构（`for attempt in 0..MAX_RETRIES`）、错误分类（网络错误 vs 服务端错误 vs 客户端错误）、指数退避逻辑几乎完全相同。两个 `stream_response` 函数的缓冲区处理逻辑结构一致。`ai/mod.rs` 的 `generate_streaming` 便捷函数中还有 `match config.provider` 的硬编码分发。
- **影响**：新增 provider（如 Claude、llama.cpp）需要复制粘贴 ~50 行重试模板。ADR-004 的初衷是「重试逻辑可以下沉到 trait 层」，但实际未做。
- **方案**：将重试逻辑提取为通用辅助函数（不改 trait 结构，避免 async dyn 复杂度）：
  ```rust
  // ai/mod.rs
  /// 通用重试执行器：处理网络错误 + 5xx 重试 + 指数退避。
  pub(crate) async fn with_retry<F, Fut, T>(max_retries: u32, op: F) -> Result<T>
  where
      F: Fn() -> Fut,
      Fut: std::future::Future<Output = std::result::Result<T, RetryDecision>>,
  { ... }
  
  enum RetryDecision {
      Retry,        // 网络错误 / 5xx，可重试
      Fatal(AppError),  // 4xx / 解析错误，不可重试
      Success(T),
  }
  ```
  openai.rs / ollama.rs 只需实现 HTTP 请求构建 + 响应解析，重试策略统一。预计可减少 ~80 行重复代码。
- **成本**：M（需仔细处理泛型 + async）
- **风险**：中——async 泛型 + trait bound 需谨慎；建议先加测试覆盖再重构

---

### [P1-7] image.rs 与 image_batch.rs 共用逻辑可进一步提取

- **问题**：`commands/image.rs:11-95` 的 `generate_image_common` 封装了单图生成流程（emit progress → generate → save → meta），而 `image_batch.rs:176-255` 的 `generate_one_scene` 几乎完全独立地实现了同样的「generate → save → meta」流程，但不复用 `generate_image_common`（因为批量版本需要自定义进度回调和 meta_lock）。
- **影响**：图片保存逻辑（`save_image_file` → 构造 `ImageResult` → `append_image_meta`）在两处各写一遍，字段构造（id/kind/prompt/created/ref_id）必须同步。
- **方案**：在 `services/image` 模块新增一个纯函数，接收已生成的 `GeneratedImageData` + 元信息，返回 `ImageResult` 并落盘：
  ```rust
  // services/image/meta.rs 或新文件
  pub fn save_and_register(dir: &Path, kind: ImageKind, prompt: &str,
                           bytes: &[u8], ref_id: Option<String>) -> Result<ImageResult> {
      let id = generate_id();
      let local_path = save_image_file(dir, &kind, &id, bytes)?;
      Ok(ImageResult {
          id, kind, prompt: prompt.to_string(), revised_prompt: None,
          local_path, file_size: bytes.len() as u64,
          created: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
          ref_id,
      })
  }
  ```
  单图命令和批量命令都调用此函数。meta_lock 仍留在批量命令层（合理——并发控制在命令层）。
- **成本**：S（半天）
- **风险**：低

---

### [P1-8] 前端路由无懒加载——首屏加载全部 7 个页面

- **问题**：`src/App.tsx:4-10` 静态 import 全部 7 个 feature 页面组件。Vite 会将它们打包进同一个 chunk，首屏加载时下载全部页面代码（含 docx 导出库、react-markdown 等重依赖），即使首次只看 Dashboard。当前 bundle 1MB+ / gzip 328KB 中，docx（~200KB）和 react-markdown 链路占大头，但只在导出页和详情页使用。
- **影响**：首屏加载偏慢，尤其网络不佳时。对桌面应用影响相对小（本地加载），但仍非最佳实践。
- **方案**：用 React.lazy + Suspense 懒加载非首页路由：
  ```tsx
  const Chapters = lazy(() => import("@/features/chapters"));
  const Illustrations = lazy(() => import("@/features/illustrations"));
  const Export = lazy(() => import("@/features/export"));
  // ...
  <Suspense fallback={<PageSkeleton />}>
    <Routes>...</Routes>
  </Suspense>
  ```
  Vite 自动按路由拆分 chunk。Dashboard/CreateNovel/Outline 等小页面可保持静态加载（首屏即用）。
- **成本**：S（2 小时）
- **风险**：低——需处理 Suspense fallback 的加载状态 UI

---

### [P2-1] API Key 明文存储于 config.yaml

- **问题**：`core/src/domain/config.rs:135` `pub api_key: String` 和 `pub image_api_key: String`，通过 `services/config.rs` 以明文 YAML 存入 `~/.config/autowrite/config.yaml`。SPEC.md §5.4 要求「API Key 不得出现在错误消息或日志中」，但存储层面未做保护。
- **影响**：本地文件系统上的 config.yaml 含明文 API Key。在单用户桌面应用中风险可控（用户自己的文件），但若用户误传配置文件到 Git 或分享，会泄露密钥。
- **方案**：引入系统 keychain 存储（跨平台）：
  - 使用 `keyring` crate（支持 macOS Keychain / Windows Credential Manager / Linux Secret Service）
  - config.yaml 中只存一个标识（如 `api_key_ref: "autowrite_openai_key"`），实际密钥存 keychain
  - 加载时从 keychain 读取；保存时写入 keychain
  - 提供降级方案：keychain 不可用时回退到明文（带警告日志）
  - **注意**：这是 P2 而非 P0，因为桌面应用的本地文件保护通常依赖 OS 文件权限，当前风险可控。优先级取决于是否有分享配置文件的使用场景。
- **成本**：M（需引入依赖 + 跨平台测试 + 迁移逻辑）
- **风险**：中——Linux 上 Secret Service 依赖 gnome-keyring / kwallet，无桌面环境时不可用，需降级方案

---

### [P2-2] 章节列表无虚拟化——超长小说性能下降

- **问题**：`src/features/chapters/index.tsx:56-75` 用 `ScrollArea` + `chapters.map()` 渲染全部章节卡片。当小说章节数超过 100-200 章时，DOM 节点数线性增长，滚动卡顿。
- **影响**：网文目标用户常写 100-500 章，章节列表可能很重。
- **方案**：当章节数超过阈值（如 50）时启用虚拟化：
  ```bash
  npm install @tanstack/react-virtual
  ```
  ```tsx
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: chapters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });
  ```
  章节数 < 50 时 fallback 到普通 map（避免引入虚拟化复杂度）。
- **成本**：M（需引入依赖 + 适配 ScrollArea 的 API 差异）
- **风险**：中——虚拟化与 ScrollArea 的嵌套滚动需调试

---

### [P2-3] 缺少结构化日志——全靠 println!/eprintln!

- **问题**：后端无任何日志框架。`generate.rs` 的轮询进度、`memory.rs` 的解析失败、AI 调用的耗时——这些关键调试信息要么没有日志，要么用 `eprintln!`（如 `full_flow.rs` 测试中的彩色 eprintln）。用户遇到 bug 时无法提供有效日志。
- **影响**：线上问题排查困难，无法定位 AI 调用失败原因。
- **方案**：引入 `tracing` + `tracing-subscriber`：
  ```toml
  # core/Cargo.toml
  tracing = "0.1"
  # app-tauri/Cargo.toml
  tracing-subscriber = { version = "0.1", features = ["env-filter"] }
  ```
  在 `lib.rs::run()` 初始化 subscriber。关键路径加 `#[tracing::instrument]`：AI 调用（记录 model/duration/重试次数）、文件写入、错误路径。日志级别通过 `RUST_LOG` 环境变量控制，默认 `info`，调试时 `debug`。
- **成本**：M（需改 core + app 多处，但增量）
- **风险**：低——tracing 是 Rust 生态标准方案

---

### [P2-4] 测试覆盖不足——关键路径无单元测试

- **问题**：当前 Rust 测试仅 12 个（config_test.rs 7 个 + lora.rs 2 个 + generate.rs 1 个 + util.rs 3 个），全在配置和工具函数层。核心业务逻辑零覆盖：
  - `storage/outline.rs::parse_outline_text`（大纲解析，AI 输出格式多变，最易出错）无测试
  - `storage/context.rs::read_context`（正反向对称性脆弱）无测试
  - `domain/memory.rs::merge_facts`（记忆合并逻辑）无测试
  - `dto/novel.rs` 的 `From` 转换（契约对齐核心）无测试
  - 前端零测试（虽装了 vitest + testing-library 但无测试文件）
- **影响**：重构无安全网，回归风险高。
- **方案**：
  1. **后端优先**：为 `parse_outline_text` 添加多格式输入测试（带/不带 `- ` 前缀、不同数字格式、空大纲）；为 `read_context` ↔ `write_context` 加往返测试（验证对称性，直接暴露 P1-4 的问题）；为 `merge_facts` 加结构化 JSON 输入测试。
  2. **前端**：为 `services/tauri.ts` 的 `invokeSafe` 错误处理、`stores` 的状态流转加 vitest 单测。优先级低于后端。
- **成本**：L（需持续补充，建议每个 P1 重构同步加测试）
- **风险**：低——纯增加测试

---

### [P2-5] docx 导出依赖未实际使用/冗余

- **问题**：`package.json` 依赖 `docx: ^9.6.1`，但后端 `export.rs` 只实现 md/txt 导出，docx/pdf 导出在 SPEC.md 中标注为「DOCX 前端生成，PDF 打印视图」。需确认前端是否已实现 docx 生成逻辑，若未实现则该依赖为 dead weight。此外 `react-markdown` + `remark-gfm` 仅在章节阅读视图和 Dashboard 使用，体积较大。
- **影响**：未使用的依赖增加 bundle 体积。
- **方案**：审计前端 `export` feature 和 `utils/export-docx.ts` 是否存在且使用 docx 库。若未使用，移除依赖（节省 ~200KB）。若已使用，确保其通过路由懒加载（P1-8）隔离到导出页 chunk。
- **成本**：S（确认 + 决策）
- **风险**：无

---

### [P2-6] capabilities 配置不完整——缺少 protocol-asset 权限声明

- **问题**：`app-tauri/capabilities/default.json` 只声明了 `core:default`、`dialog:default`、`dialog:allow-open`，但 SPEC.md §5.4 和 §12.3 要求 `protocol-asset` 权限用于图片预览。当前图片预览依赖运行时 `app.asset_protocol_scope().allow_directory()` 动态授权（`commands/system.rs:10-14`），capabilities 层面未声明 `protocol-asset`。
- **影响**：图片预览功能依赖运行时动态授权，如果 Tauri 的默认 capability 不包含 asset protocol，可能在某些平台上图片不显示。
- **方案**：在 `default.json` 补充权限声明：
  ```json
  {
    "permissions": [
      "core:default",
      "dialog:default",
      "dialog:allow-open",
      "core:app:default"
    ]
  }
  ```
  并实测确认 `convertFileSrc` 能正常加载图片。如果当前运行正常，说明运行时授权已足够，此条可降为 P3（文档级确认）。
- **成本**：S（验证为主）
- **风险**：低

---

### [P2-7] CLI config get/set 字段命名不一致

- **问题**：`cli/src/commands.rs:125-142` 的 `print_config_field` 和 `set_config_field` 中，字段名混用连字符和下划线：`"api-key"` vs `"api_base_url"`、`"ollama-url"` vs `"ollama_model"`。用户需要记住哪个字段用哪种分隔符。同时 `provider` 打印用 `format!("{:?}").to_lowercase()` 会输出 `openai`/`ollama`（恰好正确），但 set 时用 `match value.to_lowercase()`（也正确），不过 Debug derive 的输出格式不可依赖。
- **影响**：CLI 用户体验差，字段名记忆负担。
- **方案**：统一为连字符命名（kebab-case）并增加 alias 兼容：
  ```rust
  "api-key" | "api_key" => ...,
  "api-url" | "api_base_url" => ...,
  ```
  或用 `clap` 的 derive 直接绑定 `AppConfig` 的子集，自动生成帮助。同时增加 `config list` 子命令打印所有可用字段名。
- **成本**：S（2 小时）
- **风险**：无

---

### [P3-1] domain → storage 硬耦合（长期可引入 trait 抽象）

- **问题**：ADR-009 §3.2 方案 C 选择将 `storage` 整体放入 core，domain 函数直接 `use crate::storage` 调用文件读写。这使得 domain 业务逻辑与「文件系统存储」实现绑定——如果未来要支持 SQLite、S3 或内存存储（测试场景），需改所有 domain 函数。ADR-009 明确「NovelStore trait 暂不定义（YAGNI）」，这是正确的 MVP 决策。
- **影响**：长期来看，存储层扩展受限。但当前单机文件存储是产品的核心定位，短期无需求。
- **方案**：远期当出现以下需求之一时再引入 trait：
  - 需要支持 SQLite 存储后端
  - 需要可 mock 的存储层做 domain 单元测试（目前靠临时目录测试，可用）
  - 需要 Web 版本（存储后端不同）
  
  届时定义 `NovelStore` trait，domain 函数加 `store: &impl NovelStore` 参数，storage 模块提供 `LocalFileStore` 实现。**当前不建议做**——ADR-009 的 YAGNI 决策正确。
- **成本**：L（涉及全量 domain 函数签名变更）
- **风险**：高——大面积改动，需配合 P2-4 的测试覆盖

---

### [P3-2] 新增 AI Provider 的扩展路径（Claude / 本地模型）

- **问题**：当前 AiProvider trait + `create_provider` 设计（ADR-004）已支持新增 provider：新建 `xxx.rs` → impl `AiProvider` → match 加分支。但实际新增 Claude（Anthropic API）时，消息格式（system/user/assistant）、流式协议（SSE vs chunked JSON）与 OpenAI 不同，需要独立实现 HTTP 请求构建和流解析。
- **影响**：扩展可行但每增一个 provider 约 150-200 行代码（含流解析）。
- **方案**：当前设计已合理。建议在新增第二个非 OpenAI 兼容 provider 时，评估是否需要：
  - 提取通用流式 SSE 解析器（OpenAI 和 Claude 都用 SSE，只是事件格式不同）
  - 消息类型枚举（System/User/Assistant）替代当前只有 User 的硬编码
- **成本**：M（每个新 provider）
- **风险**：低——增量扩展

---

### [P3-3] 多小说项目管理——当前仅单目录

- **问题**：当前架构为「一个 novel_dir 一个项目」，切换项目需重新选目录。`AppState.novel_dir` 是全局单一值。多项目（如用户同时创作 2-3 部小说）需频繁切换目录，且切换后前端 store 需手动刷新。
- **影响**：多项目用户需手动管理目录切换。
- **方案**：远期实现项目列表管理：
  - config.yaml 维护 `recent_dirs: Vec<PathBuf>`
  - 前端 Dashboard 增加项目切换器（下拉列表）
  - 切换时重置所有 store + 重新加载
  - 每个项目独立的 images/meta.json 和 config 覆盖
- **成本**：M
- **风险**：中——涉及状态管理重构

---

### [P3-4] Rust↔TS 类型同步未自动化（tauri-specta 升级路径）

- **问题**：ADR-005 决定 MVP 手写 TS 类型，依赖 PR 审查防止类型漂移。当前 `types/index.ts`（241 行）与 Rust DTO 手动维护，命令数已达 26 个（含批量），类型漂移风险随迭代增长。
- **影响**：偶发的类型不匹配 bug（如字段名 camelCase 拼写不一致），靠手动审查拦截。
- **方案**：当命令数增长到 30+ 或出现类型漂移 bug 时，引入 `tauri-specta`（需 specta v2 稳定版）：
  - 在 DTO struct 加 `#[derive(Type)]`
  - 在 command 加 `#[specta::specta]`
  - 构建时自动生成 `types/bindings.ts`
  - 前端 import 自动生成的类型
- **成本**：M（集成 + 全量 DTO 加属性）
- **风险**：中——tauri-specta 依赖 specta v2，需确认稳定性

---

## 实施路线图建议

### 短期（1-2 周）：P0 全清 + 高价值 P1

| 序号 | 优化点 | 成本 | 说明 |
|------|--------|------|------|
| 1 | P0-1 CI 路径修正 | S | 阻塞所有后端 CI，最高优先 |
| 2 | P0-2 memory.rs UTF-8 截断 | S | 核心 bug，1 小时修复 |
| 3 | P0-4 config 原子写入 | S | 1 小时修复 |
| 4 | P0-3 路径穿越防护 | S | 安全加固 |
| 5 | P1-1 AppError 补 Config 变体 | S | 错误处理完善 |
| 6 | P1-5 workspace 依赖集中管理 | S | DX 改善 |
| 7 | P1-2 list_chapters 去重 | S | 代码质量 |

### 中期（1 月）：P1 剩余 + 高价值 P2

| 序号 | 优化点 | 成本 | 说明 |
|------|--------|------|------|
| 8 | P1-4 context.md 读写重构 | M | 记忆系统可靠性，建议配合 P2-4 测试 |
| 9 | P1-3 流式重试文本隔离 | M | 用户体验 |
| 10 | P1-8 前端路由懒加载 | S | 首屏性能 |
| 11 | P2-3 引入 tracing 日志 | M | 可观测性 |
| 12 | P2-4 补充核心路径测试 | L | 持续进行 |
| 13 | P1-6 AI 重试逻辑提取 | M | 代码质量，需测试先行 |

### 长期（季度）：P2 剩余 + P3 规划

| 序号 | 优化点 | 成本 | 说明 |
|------|--------|------|------|
| 14 | P2-1 API Key keychain | M | 安全增强 |
| 15 | P2-2 章节列表虚拟化 | M | 性能（当章节数 > 100 时触发） |
| 16 | P1-7 image 共用逻辑提取 | S | 代码质量 |
| 17 | P3-x | — | 按需规划 |

---

## 附：审计中发现的"做得好的地方"

1. **ADR-009 的 core 抽离执行到位**：core crate 真正零 Tauri 依赖，CLI 的成功实现（`cli/src/commands.rs` 直接调用 core 的 `generate_outline_streaming_with_progress` 等）证明 core 可独立复用。进度回调设计（`ProgressEvent` → 闭包注入）干净利落地斩断了 Tauri 耦合，是教科书级的架构决策落地。

2. **DTO 层契约对齐质量高**：`dto/novel.rs` 的 `From` 实现完整覆盖了 SPEC 6.3 的字段映射（`world → worldView`、`chapter → number`、`words → wordCount`），`ChapterMetaDto::from_meta` 工厂方法优雅地解决了「领域类型无 filename 字段」的契约差异。`AppConfigDto::apply_to` 的「以磁盘为基底覆盖暴露子集」策略（而非全量反向映射）正确避免了 save_config 丢字段风险。

3. **批量并发的正确性处理专业**：`image_batch.rs` 用 `Arc<Mutex<()>>` 串行化 `append_image_meta` 的非原子 read-modify-write，正确消除了并发丢失更新；`buffer_unordered(BATCH_CONCURRENCY)` 配合 API 限流约束；错误隔离（单章失败不阻塞其他）设计合理。`image_batch_progress.rs` 将进度辅助函数独立拆分，保持单文件 ≤300 行。

4. **前端 store 分层清晰**：4 个 Zustand store 各司其职，`novel-store.ts` 的流式状态管理（`startGeneration` / `appendStreamChunk` / `finishGeneration` 三态流转）干净；`use-batch-image-generation.ts` 用 `progressRef` 防止 await 期间闭包捕获旧 state 的 bug——这种细节说明开发者理解 React 的闭包陷阱。

5. **原子文件写入贯穿全项目**：`storage::write_file_atomic`（先写 .tmp 再 rename + .bak 备份）被所有数据文件写入使用（novel.md / outline.md / context.md / chapters/*.md / meta.json），只有 config.yaml 例外（见 P0-4）。这种一致性体现了良好的工程纪律。
