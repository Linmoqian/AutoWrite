// 图片生成流程封装，照搬 src-tauri/src/commands.rs:498-688 的 generate_image_common。
// 推送 image-progress 事件：preparing→submitting→polling(轮询期)→saving→done
// 三种 kind：cover（refId=null）、character（refId=名字）、scene（refId=ch{NNN}）

import type { AppConfig } from "../config.js";
import { readNovel, getChapterOutline, saveImageFile, appendImageMeta, listChapters, readChapter } from "../files/index.js";
import type { ImageKind, ImageResult, NovelData } from "../files/index.js";
import { generateId } from "../files/index.js";
import { AppError } from "../error.js";
import { emitImageProgress } from "../lib/sse.js";
import {
  generateImage,
  buildCoverPrompt,
  buildCharacterPrompt,
  buildScenePrompt,
  extractScene as extractSceneCore,
  type SceneDescription,
} from "./modelscope.js";

function nowFormatted(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

// generate_image_common，照搬 commands.rs:498-583
async function generateImageCommon(
  dir: string,
  config: AppConfig,
  kind: ImageKind,
  refId: string | null,
  promptBuilder: (novel: NovelData) => string,
  preparingMsg: string,
  doneMsg: string,
): Promise<ImageResult> {
  const novel = readNovel(dir);

  emitImageProgress({ stage: "preparing", message: preparingMsg });

  const prompt = promptBuilder(novel);

  emitImageProgress({ stage: "submitting", message: "正在提交图片生成任务..." });

  const generated = await generateImage(config, prompt, (msg) => {
    emitImageProgress({ stage: "polling", message: msg });
  });

  const id = generateId();
  const localPath = saveImageFile(dir, kind, id, generated.bytes);

  emitImageProgress({ stage: "saving", message: "正在保存图片...", imageId: id });

  const result: ImageResult = {
    id,
    kind,
    prompt,
    revisedPrompt: null,
    localPath,
    fileSize: generated.bytes.length,
    created: nowFormatted(),
    refId,
  };

  appendImageMeta(dir, result);

  emitImageProgress({ stage: "done", message: doneMsg, imageId: id });

  return result;
}

// generate_cover，照搬 commands.rs:585-605
export async function generateCover(dir: string, config: AppConfig): Promise<ImageResult> {
  const title = readNovel(dir).title;
  return generateImageCommon(
    dir,
    config,
    "cover",
    null,
    (novel) => buildCoverPrompt(config.image_prompts, novel.title, novel.genre, novel.theme),
    `正在为《${title}》生成封面...`,
    "封面生成完成",
  );
}

// generate_character_image，照搬 commands.rs:607-629
export async function generateCharacterImage(
  dir: string,
  config: AppConfig,
  characterName: string,
  characterDesc: string,
): Promise<ImageResult> {
  const name = characterName;
  const desc = characterDesc;
  return generateImageCommon(
    dir,
    config,
    "character",
    characterName,
    (novel) => buildCharacterPrompt(config.image_prompts, novel.title, name, desc),
    `正在为角色「${characterName}」生成立绘...`,
    `角色「${characterName}」立绘生成完成`,
  );
}

// generate_scene_image，照搬 commands.rs:631-666
export async function generateSceneImage(
  dir: string,
  config: AppConfig,
  chapterNum: number,
  sceneDesc: string,
  mood: string,
): Promise<ImageResult> {
  const chapterTitle =
    getChapterOutline(dir, chapterNum) ?? `第${chapterNum}章`;
  const sd = sceneDesc;
  const md = mood;
  return generateImageCommon(
    dir,
    config,
    "scene",
    `ch${String(chapterNum).padStart(3, "0")}`,
    (novel) =>
      buildScenePrompt(
        config.image_prompts,
        novel.title,
        chapterNum,
        chapterTitle,
        sd,
        md,
      ),
    `正在为第${chapterNum}章「${chapterTitle}」生成场景插图...`,
    `第${chapterNum}章场景插图生成完成`,
  );
}

// extract_scene_description，照搬 commands.rs:668-688
// 返回 {sceneDesc, mood}（camelCase，对应 Rust SceneDescription 的 rename_all）
export async function extractSceneDescription(
  dir: string,
  config: AppConfig,
  chapterNum: number,
): Promise<{ sceneDesc: string; mood: string }> {
  const chapters = listChapters(dir);
  const chapter = chapters.find((c) => c.chapter === chapterNum);
  if (!chapter) {
    throw AppError.image(`第 ${chapterNum} 章不存在`);
  }
  const filename = `${String(chapterNum).padStart(3, "0")}-${chapter.title}.md`;
  const { body } = readChapter(dir, filename);
  const desc: SceneDescription = await extractSceneCore(config, body);
  return { sceneDesc: desc.scene_desc, mood: desc.mood };
}
