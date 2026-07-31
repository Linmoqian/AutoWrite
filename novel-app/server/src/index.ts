// AutoWrite Node.js 后端入口。
// 替代 src-tauri/src/lib.rs：加载配置 → 初始化状态 → 起 HTTP 服务 → 注册路由。
// 开发：Vite(1422) 经 proxy 访问 Node(3000)；生产：Node 同源托管前端 dist。

import * as fs from "node:fs";
import * as path from "node:path";

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { defaultConfigPath, loadConfig } from "./config.js";
import { errorToString, normalizeError } from "./error.js";
import { initAppState } from "./state.js";
import { registerConfigRoutes } from "./routes/config.js";
import { registerEventsRoute } from "./routes/events.js";
import { registerExportRoutes } from "./routes/export.js";
import { registerImageRoutes } from "./routes/images.js";
import { registerNovelRoutes } from "./routes/novel.js";

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
  // 抛出的可能是 AppErrorVariant 对象或原生 Error，统一归一化
  app.setErrorHandler((err, _req, reply) => {
    const variant = normalizeError(err);
    const message = errorToString(variant);
    reply.status(422).send(message);
  });

  // 健康检查
  app.get("/api/health", () => ({ ok: true }));

  // 注册业务路由
  registerConfigRoutes(app);
  registerNovelRoutes(app);
  registerExportRoutes(app);
  registerImageRoutes(app);
  registerEventsRoute(app);

  // 生产环境：托管前端 dist（开发由 Vite 提供）
  const distDir = process.env.AUTOWRITE_DIST_DIR;
  if (distDir && fs.existsSync(distDir)) {
    await app.register(fastifyStatic, {
      root: path.resolve(distDir),
      prefix: "/",
      wildcard: false,
    });
    // SPA fallback：未匹配的 GET 路由返回 index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api") && !req.url.startsWith("/events")) {
        return reply.sendFile("index.html");
      }
      reply.code(404).send({ error: "Not Found" });
    });
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`AutoWrite server listening on http://${HOST}:${PORT}`);
  } catch (e) {
    console.error("启动失败:", e);
    process.exit(1);
  }
}

main();
