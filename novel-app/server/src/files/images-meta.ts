// 图片元数据操作，照搬 src-tauri/src/image.rs:380-451。
// meta.json 是 ImageResult 数组（JSON），字段 camelCase；kind 用 snake_case。
// revised_prompt / ref_id 为 null（不省略）。

import * as fs from "node:fs";
import * as path from "node:path";

import { AppError } from "../error.js";
import { writeFileAtomic } from "./atomic.js";

export type ImageKind = "cover" | "character" | "scene";

export interface ImageResult {
  id: string;
  kind: ImageKind;
  prompt: string;
  revisedPrompt: string | null;
  localPath: string;
  fileSize: number;
  created: string;
  refId: string | null;
}

export function imagesDir(dir: string): string {
  return path.join(dir, "images");
}

export function imagesMetaFile(dir: string): string {
  return path.join(imagesDir(dir), "meta.json");
}

// 保存图片文件，返回文件名（不含目录）。照搬 image.rs:389-403
export function saveImageFile(
  dir: string,
  kind: ImageKind,
  id: string,
  bytes: Buffer,
): string {
  const imgDir = imagesDir(dir);
  try {
    fs.mkdirSync(imgDir, { recursive: true });
  } catch (e) {
    throw AppError.io(e);
  }
  const prefix = kind === "cover" ? "cover" : kind === "character" ? "char" : "scene";
  const filename = `${prefix}_${id}.png`;
  const filePath = path.join(imgDir, filename);
  try {
    fs.writeFileSync(filePath, bytes);
  } catch (e) {
    throw AppError.io(e);
  }
  return filename;
}

// 读取全部图片元数据。照搬 image.rs:405-413
export function listImages(dir: string): ImageResult[] {
  const metaPath = imagesMetaFile(dir);
  if (!fs.existsSync(metaPath)) return [];
  let content: string;
  try {
    content = fs.readFileSync(metaPath, "utf8");
  } catch (e) {
    throw AppError.io(e);
  }
  try {
    const arr = JSON.parse(content);
    return Array.isArray(arr) ? (arr as ImageResult[]) : [];
  } catch (e) {
    throw AppError.json(e);
  }
}

// 追加一条元数据。照搬 image.rs:415-419
export function appendImageMeta(dir: string, result: ImageResult): void {
  const images = listImages(dir);
  images.push(result);
  saveAllImagesMeta(dir, images);
}

// 全量保存元数据（pretty JSON + 原子写入）。照搬 image.rs:421-426
export function saveAllImagesMeta(dir: string, images: ImageResult[]): void {
  const imgDir = imagesDir(dir);
  try {
    fs.mkdirSync(imgDir, { recursive: true });
  } catch (e) {
    throw AppError.io(e);
  }
  const content = JSON.stringify(images, null, 2);
  writeFileAtomic(imagesMetaFile(dir), content);
}

// 删除图片（文件 + 元数据）。照搬 image.rs:428-443
export function deleteImage(dir: string, imageId: string): void {
  const images = listImages(dir);
  const imgDir = imagesDir(dir);
  const remaining = images.filter((img) => {
    if (img.id === imageId) {
      try {
        fs.unlinkSync(path.join(imgDir, img.localPath));
      } catch {
        // Rust: let _ = 忽略删除失败
      }
      return false;
    }
    return true;
  });
  saveAllImagesMeta(dir, remaining);
}

// 生成 id：unix 毫秒的十六进制。照搬 image.rs:445-451
export function generateId(): string {
  const ts = Date.now();
  return ts.toString(16);
}
