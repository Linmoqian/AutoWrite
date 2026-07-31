// AutoWrite Node.js 后端入口。
// 替代 src-tauri/src/lib.rs 的启动职责：加载配置 → 初始化状态 → 起 HTTP 服务。
// 阶段 0 仅挂 config 路由验证骨架；后续阶段逐步挂载其余路由。

import Fastify from "fastify";

import { defaultConfigPath, loadConfig, saveConfig } from "./config.js";
import { errorToString, normalizeError } from "./error.js";
import { initAppState, getState } from "./state.js";
import type { AppConfig } from "./config.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";

async function main() {
  // 照搬 lib.rs:22-27：先加载配置，取出 novel_dir 预填状态
  const configPath = defaultConfigPath();
  const savedConfig = loadConfig(configPath);
  const savedDir = savedConfig.novel_dir ?? null;
  initAppState(configPath, savedDir);

  const app = Fastify({ logger: false });

  // 统一错误处理：把 AppErrorVariant 序列化成中文字符串返回（匹配前端 String(e)）
  app.setErrorHandler((err, _req, reply) => {
    const variant = normalizeError(err);
    const message = errorToString(variant);
    // 422 对应 Rust 命令拒绝的语义；前端只看 message 字符串
    reply.status(422).send(message);
  });

  // 健康检查
  app.get("/api/health", () => ({ ok: true }));

  // —— config 路由（阶段 0 验证用）——
  // load_config / save_config 命令的字段契约保持 snake_case
  app.get("/api/config", () => {
    return loadConfig(getState().configPath);
  });

  app.post("/api/config", async (req) => {
    const config = (req.body ?? {}) as AppConfig;
    saveConfig(getState().configPath, config);
    return null;
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    // eslint-disable-next-line no-console
    console.log(`AutoWrite server listening on http://${HOST}:${PORT}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("启动失败:", e);
    process.exit(1);
  }
}

main();
