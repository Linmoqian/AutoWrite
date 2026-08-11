# ADR-008：DTO 层与前端 SPEC 6.3 类型契约对齐

- **状态**：已接受
- **日期**：2026-08-12
- **决策者**：Team Lead（MvpDevExpertTeam）
- **取代**：无（补充 ADR-007 dto 分层）

## 背景

ADR-007 建立了 `dto/` 分层，将 IPC 视图与领域类型分离。但当前实现存在
**严重的契约不匹配**：多个 DTO 直接嵌入后端领域类型（`NovelData`、`ContextData`、
`Volume`、`AppConfig`），而领域类型为保持磁盘文件格式兼容仍用 snake_case
且字段命名不同。前端 `src/types/index.ts`（SPEC 6.3）声明的契约期望 camelCase
且字段名不同。`AppConfig` 完全没有 DTO，`load_config` 直接返回领域配置。

逐字段对照（已读全部源码确认）：

| 前端类型（SPEC 6.3） | 当前后端输出 | 缺口 |
|---|---|---|
| `NovelData.targetChapters` | 领域 `target_chapters` | 命名 |
| `NovelData.worldView` | 领域 `world: Option<String>` | 命名 + 解包 |
| `NovelData.createdAt` | 领域 `created` | 命名 |
| `ChapterMeta.filename` | **无**（领域只有 `chapter/title/words/created`） | 缺字段 |
| `ChapterMeta.number` | 领域 `chapter` | 命名 |
| `ChapterMeta.wordCount` | 领域 `words` | 命名 |
| `ChapterMeta.createdAt` | 领域 `created` | 命名 |
| `ContextData.characterStates: CharacterState[]` | 领域 `Vec<serde_yaml::Value>` | 形状 |
| `ContextData.plotEvents: PlotEvent[]` | 领域 `Vec<String>` | 形状 |
| `ImageResult.filename` | DTO `local_path`（全路径） | 命名 + 需 basename |
| `ImageResult.refText` | DTO `ref_id` | 命名 |
| `ImageResult.createdAt` | DTO `created` | 命名 |
| `AppConfig.openai/ollama/image`（嵌套） | 领域 flat（`model/ollama_model/api_base_url/...`） | **结构 + 无 DTO** |
| `ExportChapter.wordCount` | DTO `words` | 命名 |

## 决策

**DTO 层承担契约映射责任**——领域类型保持磁盘兼容不动，DTO 输出严格对齐
前端 SPEC 6.3。具体动作：

### 后端

1. **`dto/novel.rs` 重写**：
   - `NovelDataDto`（独立结构，非嵌入）：`title/genre/theme/targetChapters/worldView/characters/createdAt`，
     `From<NovelData>` 做字段重命名与 `Option` 解包（`world.unwrap_or_default()`）。
   - `ChapterMetaDto`：新增 `filename: String` 字段（值由命令层注入
     `format!("{:03}-{}.md", chapter, safe_title)`），`number/wordCount/createdAt`
     由领域 `chapter/words/created` 映射。
   - `NovelStatusDto`：嵌入新 `NovelDataDto`（替换领域 `NovelData`）。
   - `ContextDataDto`：`characterStates` 由 `Vec<serde_yaml::Value>` 经
     `serde_json::Value` 透传（前端宽类型），`plotEvents/unresolvedThreads`
     包装 `{chapter, event}` / `{item, status}`；`emotionalArc/currentIntent`
     直传。
   - `VolumeDto` + `ChapterEntryDto`：`title` 来自领域 `volume`，`ChapterEntry`
     增加 `summary`（占位 `""`，前端不依赖）。

2. **`dto/config.rs` 新增**（缺失模块）：
   - `AppConfigDto { provider, openai, ollama, prompts, image }`，三段嵌套结构。
   - `OpenAiConfigDto { apiKey, apiUrl, model, timeout }` ← 领域
     `api_key/api_base_url/model/timeout`。
   - `OllamaConfigDto { apiUrl, model, timeout, numCtx }` ← 领域
     `ollama_url/ollama_model(or model)/timeout/num_ctx`。
   - `ImageConfigDto { model, apiUrl, apiToken, loras, size }` ← 领域
     `image_model/image_api_base_url/image_api_key/image_loras/image_size`。
   - `PromptsDto { worldView, characters, outline, chapter }` ← 领域
     `Prompts.world/character/outline/chapter`（仅 4 个前端用到的）。
   - `save_config` 接受 `AppConfigDto`，`From<AppConfigDto> for AppConfig` 反向映射。

3. **`commands/*.rs` 改造**：
   - `load_config`/`save_config` 返回/接受 `AppConfigDto`。
   - `list_chapters`/`read_chapter`：构造 `filename` 字符串注入 DTO。
   - `get_status`：`NovelStatus.into()` 自动生效。
   - `get_export_data`：`ExportDataDto` 嵌入新 `NovelDataDto`。

4. **`save_config` 字段对齐**：前端 `saveConfig` 传嵌套结构，后端 `From<AppConfigDto>`
   反向映射为 flat 领域结构再落盘，保留磁盘格式不变。

### 前端

无需改动——`types/index.ts` 已是 SPEC 6.3 标杆，DTO 输出对齐后自动匹配。
仅做 `features/` 完成迁移 + lint 修复（独立于本契约）。

## 影响与风险

- **磁盘格式不变**：领域类型 serde 不动，所有 `.md` / `config.yaml` 兼容。
- **新增映射代码**：约 200 行 DTO `From` impl，无运行时开销（编译期）。
- **向前兼容**：`ChapterMetaDto.filename` 对老前端无影响（仅新增字段）。
- **`ContextData.characterStates`**：领域存 `serde_yaml::Value`（运行时 AI
  生成），DTO 透传为 `serde_json::Value`，前端按 `CharacterState` 宽松解析。
- **风险点**：`save_config` 反向映射必须覆盖全部字段，否则用户保存配置会丢字段。
  测试用例必须覆盖 load→save 往返。

## 验证

- `cargo check` + `cargo test`（含配置 round-trip 测试）
- `npm run build`（tsc 严格模式）
- 启动 `npm run tauri dev` 手动验证：设置页加载/保存、章节列表 filename 字段
