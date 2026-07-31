// 内存状态，照搬 src-tauri/src/commands.rs 的 AppState（lib.rs:29-35 初始化）。
// Rust 中 AppState 持有 novel_dir、config_path、outline_generation 三个 Mutex；
// config 本身每次命令都重新从磁盘 load（不缓存），这里保持同样语义。

export type OutlineStep = "world" | "characters" | "outline";

// OutlineGenerationStatus —— camelCase（Rust #[serde(rename_all="camelCase")]）
export interface OutlineGenerationStatus {
  running: boolean;
  completed: boolean;
  currentStep?: OutlineStep;
  streamingText: Partial<Record<OutlineStep, string>>;
  error?: string;
}

function defaultOutlineStatus(): OutlineGenerationStatus {
  return {
    running: false,
    completed: false,
    streamingText: {},
  };
}

// 全局单例状态。Tauri 用 State<> 注入，Node 侧用模块单例即可（单进程）。
class AppState {
  novelDir: string | null = null;
  configPath: string;
  outlineGeneration: OutlineGenerationStatus = defaultOutlineStatus();

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  resetOutlineGeneration(): void {
    this.outlineGeneration = defaultOutlineStatus();
  }
}

// 进程级单例，由 index.ts 启动时初始化。
let instance: AppState | null = null;

export function initAppState(configPath: string, novelDir: string | null): AppState {
  instance = new AppState(configPath);
  instance.novelDir = novelDir;
  return instance;
}

export function getState(): AppState {
  if (!instance) {
    throw new Error("AppState 未初始化，请先调用 initAppState");
  }
  return instance;
}
