//! autowrite-core：后端可复用核心（ADR-009）。
//!
//! 零 Tauri 依赖，包含 domain（业务核心）+ services/ai（AI 能力）+
//! storage（文件持久化，方案 C）+ error + util + progress 回调。
//! 可被 CLI / Web / SDK / 批处理等非 Tauri 场景直接复用。

pub mod domain;
pub mod error;
pub mod progress;
pub mod services;
pub mod storage;

pub use progress::{OutlineStep, ProgressEvent};

// 领域类型
pub use domain::types::*;

// 配置
pub use domain::config::*;

// novel 业务
pub use domain::novel::*;

// chapter 业务
pub use domain::chapter::*;

// memory 业务
pub use domain::memory::*;

// 工具
pub use domain::util::*;

// AI 能力
pub use services::ai::*;

// 文件持久化（方案 C：files 进 core，app 通过 re-export 复用）
pub use storage::*;

// 错误
pub use error::*;
