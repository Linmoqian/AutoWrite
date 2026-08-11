pub mod config;
pub mod export;
pub mod image;

// ai 与 files（storage）已下沉至 autowrite-core（ADR-009）。
// 这里以同名 re-export 暴露，使 app 内既有的 `crate::services::files::*` /
// `crate::services::ai::*` 路径仍有效，最小化改动面。
pub use autowrite_core::services::ai;
pub use autowrite_core::storage as files;

pub use config::{load_config, save_config};
