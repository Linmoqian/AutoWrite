// 配置与连接测试路由，对应 commands.rs 的 config/ai 相关命令。
import type { FastifyInstance } from "fastify";

import { loadConfig, normalizeConfig, saveConfig } from "../config.js";
import {
  ollamaListModels,
  testAiConnection,
  testOllamaConnection,
} from "../ai/connection.js";
import { configFromState } from "../lib/state-helpers.js";
import { getState } from "../state.js";

export function registerConfigRoutes(app: FastifyInstance): void {
  // load_config
  app.get("/api/load_config", () => loadConfig(getState().configPath));

  // save_config：前端可能传入部分字段，需像 serde 反序列化一样补全默认值
  app.post("/api/save_config", async (req) => {
    const config = normalizeConfig(req.body ?? {});
    saveConfig(getState().configPath, config);
    return null;
  });

  // test_ai_connection
  app.get("/api/test_ai_connection", async () => {
    return testAiConnection(configFromState());
  });

  // ollama_list_models
  app.get("/api/ollama_list_models", async () => {
    return ollamaListModels(configFromState());
  });

  // ollama_test_connection
  app.get("/api/ollama_test_connection", async () => {
    return testOllamaConnection(configFromState());
  });
}
