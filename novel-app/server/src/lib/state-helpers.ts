// 状态访问辅助，照搬 src-tauri/src/commands.rs:28-40 的 dir_from_state / config_from_state。
// 每次命令都从磁盘重新 load config（不缓存），与 Rust 行为一致。

import { loadConfig } from "../config.js";
import type { AppConfig } from "../config.js";
import { AppError } from "../error.js";
import { getState } from "../state.js";

export function dirFromState(): string {
  const dir = getState().novelDir;
  if (dir === null) {
    throw AppError.noNovelDir();
  }
  return dir;
}

export function configFromState(): AppConfig {
  return loadConfig(getState().configPath);
}
