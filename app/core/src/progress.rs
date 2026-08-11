//! core 进度回调类型（ADR-009 §3.1）。
//!
//! core 完全不知道 Tauri 存在。生成函数通过 `on_progress(ProgressEvent)`
//! 向外推送进度事件，由调用方（app command 层）转成具体的 Tauri 事件载荷。

use serde::{Deserialize, Serialize};

/// 大纲生成内部步骤名（与提示词模板对齐）。
/// 注意：这是 core 内部口径，对外回调时已由调用方按需映射成前端契约值。
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
    OutlineStep {
        step: OutlineStep,
        chunk: String,
        done: bool,
    },
    /// 章节生成：流式文本块（done=false）或完成标记（done=true）
    ChapterChunk { chunk: String, done: bool },
}
