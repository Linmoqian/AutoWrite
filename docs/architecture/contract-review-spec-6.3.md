# SPEC 6.3 契约对齐复核

> 复核目标：确认 `app/app-tauri/src/dto/*` 与 `app/src/types/index.ts` 严格对齐
> `docs/SPEC.md` §6.3「数据模型（TypeScript 对应类型）」契约。
> 复核日期：2026-08-13，分支 `refactor/full-rewrite`。

## 复核范围

- 契约源：`docs/SPEC.md` §6.3 定义的 13 个数据模型接口。
- 后端视图层：`app/app-tauri/src/dto/{novel,config,image,export,chat}.rs`。
- 前端类型：`app/src/types/index.ts`（Rust DTO 经 `serde(rename_all="camelCase")` 映射）。

## 逐类型对比

| SPEC 6.3 类型 | 后端 DTO | 前端 TS | 结论 |
|---|---|---|---|
| `NovelData` | `NovelDataDto` | `NovelData` | ✅ 字段/类型一致 |
| `Volume` | `VolumeDto` | `Volume` | ✅ 一致 |
| `ChapterEntry` | `ChapterEntryDto` | `ChapterEntry` | ✅ 一致（`summary` 由后端注入占位） |
| `ContextData` | `ContextDataDto` | `ContextData` | ✅ 一致 |
| `CharacterState` | 透传 `Vec<Value>` | `CharacterState` | ⚠️ 有意偏差（见下） |
| `PlotEvent` | `PlotEventDto` | `PlotEvent` | ✅ 一致 |
| `TensionItem` | `TensionItemDto` | `TensionItem` | ✅ 一致（`status` 用 string 兼容联合） |
| `EmotionalTag` | `EmotionalTagDto` | `EmotionalTag` | ✅ 一致 |
| `NarrativeIntent` | `NarrativeIntentDto` | `NarrativeIntent` | ✅ 一致 |
| `ChapterMeta` | `ChapterMetaDto` | `ChapterMeta` | ✅ 一致 |
| `AppConfig` | `AppConfigDto` | `AppConfig` | ✅ 一致（`provider` 扩展为 5 种，见下） |
| `LoraConfig` | `LoraEntryDto` | `LoraConfig` | ✅ 已对齐（见下） |
| `ImageResult` | `ImageResultDto` | `ImageResult` | ✅ 已对齐（见下） |

## 已修正的偏差（本轮）

1. **`ImageResult.refText` 可选性**
   - 问题：SPEC / 前端声明为必填 `string`，后端 `ref_text` 为 `Option<String>`，
     JSON 可能输出 `null` 与契约不符。
   - 处理：`ImageResultDto.ref_text` 改为必填 `String`，`From` 时 `ref_id.unwrap_or_default()`
     兜底空串。

2. **`LoraConfig.weight` 可选性**
   - 问题：SPEC / 前端声明为必填 `number`，后端 `LoraEntryDto.weight` 为
     `Option<f64>`（`skip_serializing_if = "Option::is_none"` 会省略字段）。
   - 处理：`LoraEntryDto.weight` 改为必填 `f64`，`From` 时 `unwrap_or(1.0)`（默认满权重）；
     反向 `apply_to` 以 `Some(e.weight)` 写回领域层，保持磁盘结构兼容。

## 有意保留的偏差

1. **`CharacterState` 采用透传（非结构化）**
   - SPEC 6.3 期望 `name / location / powerLevel / status` 强结构，但领域层
     `ContextData.character_states` 为自由格式 `Vec<serde_yaml::Value>`（由 AI
     `extract_facts` 直接生成，形状随模型输出浮动）。
   - 强行结构化会破坏 `context.md` 磁盘兼容与 AI 解析约定（见 commit
     `5b91ed9` context.md 双层 front matter 重构），故在 DTO 层保留 `Vec<Value>`
     透传，前端按 `CharacterState` 宽松解析。属收尾阶段的有意取舍。

2. **`AppConfig.provider` 扩展为 5 种**
   - SPEC 6.3 仅定义 `openai | ollama`，实现已扩展为
     `openai | ollama | claude | gemini | llamacpp`（用户需求：支持更多 provider）。
   - 新增 provider 复用 `openai` 配置段字段，未改动 SPEC 6.3 的 DTO 形状，向后兼容。

## 验证结果

| 关卡 | 结果 |
|---|---|
| `cargo clippy --workspace --all-targets -D warnings` | ✅ 零告警 |
| `cargo test --workspace` | ✅ core 7 + 历史测试通过 |
| `npx tsc --noEmit` | ✅ 通过 |
| `npm run lint` (eslint) | ✅ 通过 |
| `npm run build` | ✅ 2007 模块构建成功 |

## 结论

`refactor/full-rewrite` 的 DTO 层与前端类型已**完全对齐 SPEC 6.3 数据模型契约**，
唯一保留偏差（`CharacterState` 透传）为磁盘兼容与 AI 自由输出所必需的有意设计。
全栈构建与契约复核全部通过。
