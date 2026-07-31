// 图片路由：三种生成 + 场景提取 + 列举/删除 + 静态图片服务（替代 Tauri convertFileSrc）。

import * as fs from "node:fs";
import * as path from "node:path";

import type { FastifyInstance } from "fastify";

import { AppError } from "../error.js";
import { deleteImage, imagesDir, listImages } from "../files/index.js";
import { configFromState, dirFromState } from "../lib/state-helpers.js";
import {
  extractSceneDescription,
  generateCharacterImage,
  generateCover,
  generateSceneImage,
} from "../image/index.js";

export function registerImageRoutes(app: FastifyInstance): void {
  // generate_cover
  app.post("/api/generate_cover", async () => {
    return generateCover(dirFromState(), configFromState());
  });

  // generate_character_image
  // body: { characterName, characterDesc }
  app.post("/api/generate_character_image", async (req) => {
    const { characterName, characterDesc } = (req.body ?? {}) as {
      characterName: string;
      characterDesc: string;
    };
    return generateCharacterImage(
      dirFromState(),
      configFromState(),
      characterName,
      characterDesc,
    );
  });

  // generate_scene_image
  // body: { chapterNum, sceneDesc, mood }
  app.post("/api/generate_scene_image", async (req) => {
    const { chapterNum, sceneDesc, mood } = (req.body ?? {}) as {
      chapterNum: number;
      sceneDesc: string;
      mood: string;
    };
    return generateSceneImage(
      dirFromState(),
      configFromState(),
      chapterNum,
      sceneDesc,
      mood,
    );
  });

  // extract_scene_description
  // body: { chapterNum }
  app.post("/api/extract_scene_description", async (req) => {
    const { chapterNum } = (req.body ?? {}) as { chapterNum: number };
    return extractSceneDescription(dirFromState(), configFromState(), chapterNum);
  });

  // list_images
  app.get("/api/list_images", () => listImages(dirFromState()));

  // delete_image
  // body: { imageId }
  app.post("/api/delete_image", async (req) => {
    const { imageId } = (req.body ?? {}) as { imageId: string };
    deleteImage(dirFromState(), imageId);
    return null;
  });

  // get_image_path：Rust 返回绝对路径用于 convertFileSrc；Node 侧改为返回可访问的 URL
  // 前端直接用 /api/images/<filename> 访问，此端点保留兼容性
  app.get("/api/get_image_path", async (req) => {
    const { filename } = req.query as { filename: string };
    return `/api/images/${encodeURIComponent(filename)}`;
  });

  // 静态图片服务：GET /api/images/<filename>
  // 替代 Tauri 的 asset 协议 + convertFileSrc
  app.get("/api/images/:filename", async (req, reply) => {
    const { filename } = req.params as { filename: string };
    // 防路径穿越
    if (filename.includes("..") || filename.includes("/")) {
      throw AppError.image("无效的图片文件名");
    }
    const dir = dirFromState();
    const filePath = path.join(imagesDir(dir), filename);
    if (!fs.existsSync(filePath)) {
      throw AppError.image("图片不存在");
    }
    reply.type("image/png");
    return fs.readFileSync(filePath);
  });
}
