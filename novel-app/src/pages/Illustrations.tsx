import { useState, useEffect, useRef } from "react";
import { Card, Tabs, Input, Select, Tag, Button, Popconfirm, Empty, Spin, Collapse, message } from "antd";
import { DeleteOutlined, EyeOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { ImageResult, ImageKind, ChapterMeta, ImageProgressEvent, ImagePrompts } from "../types";
import {
  generateCover,
  generateCharacterImage,
  generateSceneImage,
  extractSceneDescription,
  listImages,
  deleteImage,
  listChapters,
  onImageProgress,
  loadConfig,
  saveConfig,
  getImagePath,
} from "../services/tauri";
import LoadingButton from "../components/LoadingButton";

const { TextArea } = Input;

const stageLabel: Record<ImageProgressEvent["stage"], string> = {
  preparing: "准备中...",
  submitting: "提交任务中...",
  polling: "生成中...",
  downloading: "下载中...",
  saving: "保存中...",
  done: "完成",
};

const kindTagColor: Record<ImageKind, string> = {
  cover: "gold",
  character: "green",
  scene: "blue",
};

const kindLabel: Record<ImageKind, string> = {
  cover: "封面",
  character: "角色",
  scene: "场景",
};

async function hydrateImagePaths(images: ImageResult[]): Promise<ImageResult[]> {
  return Promise.all(
    images.map(async (image) => ({
      ...image,
      localPath: await getImagePath(image.localPath),
    })),
  );
}

// ===== Sub-components =====

function ImageCard({
  image,
  onDelete,
  onPreview,
}: {
  image: ImageResult;
  onDelete: (id: string) => void;
  onPreview: (src: string) => void;
}) {
  const src = convertFileSrc(image.localPath);

  return (
    <div className="image-card">
      <Popconfirm
        title="确定删除此图片？"
        onConfirm={(e) => {
          e?.stopPropagation();
          onDelete(image.id);
        }}
        okText="删除"
        cancelText="取消"
      >
        <Button
          className="image-card__delete"
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={(e) => e.stopPropagation()}
        />
      </Popconfirm>
      <div className="image-card__preview" onClick={() => onPreview(src)}>
        <img src={src} alt={image.refId || kindLabel[image.kind]} />
        <div className="image-card__overlay">
          <EyeOutlined />
        </div>
      </div>
      <div className="image-card__info">
        <Tag color={kindTagColor[image.kind]}>{kindLabel[image.kind]}</Tag>
        {image.refId && <span className="image-card__ref">{image.refId}</span>}
        <span className="image-card__size">
          {(image.fileSize / 1024).toFixed(0)} KB
        </span>
      </div>
    </div>
  );
}

function ImageGallery({
  images,
  loading,
  onDelete,
}: {
  images: ImageResult[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 32 }}>
        <Spin />
      </div>
    );
  }

  if (images.length === 0) {
    return <Empty description="暂无图片" />;
  }

  return (
    <>
      <div className="image-gallery">
        {images.map((img) => (
          <ImageCard
            key={img.id}
            image={img}
            onDelete={onDelete}
            onPreview={setPreviewSrc}
          />
        ))}
      </div>
      {previewSrc && (
        <div className="image-preview-overlay" onClick={() => setPreviewSrc(null)}>
          <img className="image-preview-content" src={previewSrc} alt="preview" />
        </div>
      )}
    </>
  );
}

// ===== Main component =====

export default function Illustrations() {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Cover
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverProgress, setCoverProgress] = useState("");

  // Character
  const [charName, setCharName] = useState("");
  const [charDesc, setCharDesc] = useState("");
  const [charLoading, setCharLoading] = useState(false);
  const [charProgress, setCharProgress] = useState("");

  // Scene
  const [sceneChapter, setSceneChapter] = useState<number | null>(null);
  const [sceneDesc, setSceneDesc] = useState("");
  const [sceneMood, setSceneMood] = useState("");
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneProgress, setSceneProgress] = useState("");
  const [extracting, setExtracting] = useState(false);

  // Prompt templates
  const [imagePrompts, setImagePrompts] = useState<ImagePrompts>({
    stylePrefix: "",
    cover: "",
    characterImage: "",
    scene: "",
    extractScene: "",
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [imgList, chList, config] = await Promise.all([
        listImages(),
        listChapters(),
        loadConfig(),
      ]);
      const imagesWithPaths = await hydrateImagePaths(imgList);
      if (mountedRef.current) {
        setImages(imagesWithPaths);
        setChapters(chList);
        if (config.image_prompts) {
          setImagePrompts(config.image_prompts);
        }
      }
    } catch (e) {
      message.error(String(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function refreshImages() {
    try {
      const list = await listImages();
      const imagesWithPaths = await hydrateImagePaths(list);
      if (mountedRef.current) setImages(imagesWithPaths);
    } catch (e) {
      message.error(String(e));
    }
  }

  function subscribeProgress(
    setter: (msg: string) => void,
  ): Promise<UnlistenFn> {
    return onImageProgress((e: ImageProgressEvent) => {
      setter(e.message || stageLabel[e.stage]);
    });
  }

  async function handleDelete(id: string) {
    try {
      await deleteImage(id);
      message.success("已删除");
      refreshImages();
    } catch (e) {
      message.error(String(e));
    }
  }

  async function handleSavePrompts() {
    try {
      const config = await loadConfig();
      await saveConfig({ ...config, image_prompts: imagePrompts });
    } catch {
      // ignore save errors
    }
  }

  // ===== Cover generation =====

  async function handleGenerateCover() {
    setCoverLoading(true);
    setCoverProgress("准备生成封面...");
    const unlisten = await subscribeProgress(setCoverProgress);
    try {
      await generateCover();
      message.success("封面生成完成");
      refreshImages();
    } catch (e) {
      message.error(String(e));
    } finally {
      unlisten();
      if (mountedRef.current) {
        setCoverLoading(false);
        setCoverProgress("");
      }
    }
  }

  // ===== Character generation =====

  async function handleGenerateCharacter() {
    if (!charName.trim()) {
      message.warning("请输入角色名称");
      return;
    }
    setCharLoading(true);
    setCharProgress("准备生成立绘...");
    const unlisten = await subscribeProgress(setCharProgress);
    try {
      await generateCharacterImage(charName.trim(), charDesc.trim());
      message.success("角色立绘生成完成");
      refreshImages();
    } catch (e) {
      message.error(String(e));
    } finally {
      unlisten();
      if (mountedRef.current) {
        setCharLoading(false);
        setCharProgress("");
      }
    }
  }

  // ===== Scene generation =====

  async function handleExtractScene() {
    if (sceneChapter == null) {
      message.warning("请先选择章节");
      return;
    }
    setExtracting(true);
    try {
      const result = await extractSceneDescription(sceneChapter);
      if (mountedRef.current) {
        setSceneDesc(result.sceneDesc);
        setSceneMood(result.mood);
      }
      message.success("场景提取完成");
    } catch (e) {
      message.error(String(e));
    } finally {
      if (mountedRef.current) setExtracting(false);
    }
  }

  async function handleGenerateScene() {
    if (sceneChapter == null) {
      message.warning("请选择章节");
      return;
    }
    if (!sceneDesc.trim()) {
      message.warning("请输入场景描述");
      return;
    }
    setSceneLoading(true);
    setSceneProgress("准备生成插图...");
    const unlisten = await subscribeProgress(setSceneProgress);
    try {
      await generateSceneImage(sceneChapter, sceneDesc.trim(), sceneMood.trim());
      message.success("场景插图生成完成");
      refreshImages();
    } catch (e) {
      message.error(String(e));
    } finally {
      unlisten();
      if (mountedRef.current) {
        setSceneLoading(false);
        setSceneProgress("");
      }
    }
  }

  // ===== Filtering =====

  const coverImages = images.filter((i) => i.kind === "cover");
  const charImages = images.filter((i) => i.kind === "character");
  const sceneImages = images.filter((i) => i.kind === "scene");

  const chapterOptions = chapters.map((ch) => ({
    value: ch.chapter,
    label: `第${ch.chapter}章 ${ch.title}`,
  }));

  if (loading) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h1 className="page-title">小说配图</h1>

      <Tabs
        defaultActiveKey="cover"
        items={[
          {
            key: "cover",
            label: "封面",
            children: (
              <>
                <Card size="small" title="生成封面" style={{ marginBottom: 16 }}>
                  <LoadingButton
                    type="primary"
                    loading={coverLoading}
                    onClick={handleGenerateCover}
                  >
                    {coverProgress || "生成封面"}
                  </LoadingButton>
                  <Collapse ghost style={{ marginTop: 12 }}>
                    <Collapse.Panel header="提示词设置" key="cover-prompt">
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <div style={{ marginBottom: 4, color: "var(--text-secondary)", fontSize: 13 }}>风格前缀（所有配图共用）</div>
                          <TextArea
                            value={imagePrompts.stylePrefix}
                            onChange={(e) => setImagePrompts(prev => ({ ...prev, stylePrefix: e.target.value }))}
                            onBlur={handleSavePrompts}
                            rows={2}
                          />
                        </div>
                        <div>
                          <div style={{ marginBottom: 4, color: "var(--text-secondary)", fontSize: 13 }}>封面提示词</div>
                          <TextArea
                            value={imagePrompts.cover}
                            onChange={(e) => setImagePrompts(prev => ({ ...prev, cover: e.target.value }))}
                            onBlur={handleSavePrompts}
                            rows={3}
                          />
                        </div>
                      </div>
                    </Collapse.Panel>
                  </Collapse>
                </Card>
                <ImageGallery
                  images={coverImages}
                  loading={false}
                  onDelete={handleDelete}
                />
              </>
            ),
          },
          {
            key: "character",
            label: "角色立绘",
            children: (
              <>
                <Card size="small" title="生成立绘" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Input
                      placeholder="角色名称（必填）"
                      value={charName}
                      onChange={(e) => setCharName(e.target.value)}
                    />
                    <TextArea
                      placeholder="角色外貌描述（选填）"
                      rows={3}
                      value={charDesc}
                      onChange={(e) => setCharDesc(e.target.value)}
                    />
                    <LoadingButton
                      type="primary"
                      loading={charLoading}
                      onClick={handleGenerateCharacter}
                    >
                      {charProgress || "生成立绘"}
                    </LoadingButton>
                    <Collapse ghost style={{ marginTop: 12 }}>
                      <Collapse.Panel header="提示词设置" key="char-prompt">
                        <div>
                          <div style={{ marginBottom: 4, color: "var(--text-secondary)", fontSize: 13 }}>角色立绘提示词</div>
                          <TextArea
                            value={imagePrompts.characterImage}
                            onChange={(e) => setImagePrompts(prev => ({ ...prev, characterImage: e.target.value }))}
                            onBlur={handleSavePrompts}
                            rows={3}
                          />
                        </div>
                      </Collapse.Panel>
                    </Collapse>
                  </div>
                </Card>
                <ImageGallery
                  images={charImages}
                  loading={false}
                  onDelete={handleDelete}
                />
              </>
            ),
          },
          {
            key: "scene",
            label: "场景插图",
            children: (
              <>
                <Card size="small" title="生成插图" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Select
                        placeholder="选择章节"
                        style={{ flex: 1 }}
                        options={chapterOptions}
                        value={sceneChapter}
                        onChange={setSceneChapter}
                      />
                      <Button
                        loading={extracting}
                        onClick={handleExtractScene}
                        icon={<ThunderboltOutlined />}
                      >
                        AI 提取场景
                      </Button>
                    </div>
                    <TextArea
                      placeholder="场景描述"
                      rows={3}
                      value={sceneDesc}
                      onChange={(e) => setSceneDesc(e.target.value)}
                    />
                    <Input
                      placeholder="氛围/情绪（选填）"
                      value={sceneMood}
                      onChange={(e) => setSceneMood(e.target.value)}
                    />
                    <LoadingButton
                      type="primary"
                      loading={sceneLoading}
                      onClick={handleGenerateScene}
                    >
                      {sceneProgress || "生成插图"}
                    </LoadingButton>
                    <Collapse ghost style={{ marginTop: 12 }}>
                      <Collapse.Panel header="提示词设置" key="scene-prompt">
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <div style={{ marginBottom: 4, color: "var(--text-secondary)", fontSize: 13 }}>场景提示词</div>
                            <TextArea
                              value={imagePrompts.scene}
                              onChange={(e) => setImagePrompts(prev => ({ ...prev, scene: e.target.value }))}
                              onBlur={handleSavePrompts}
                              rows={3}
                            />
                          </div>
                          <div>
                            <div style={{ marginBottom: 4, color: "var(--text-secondary)", fontSize: 13 }}>场景提取提示词</div>
                            <TextArea
                              value={imagePrompts.extractScene}
                              onChange={(e) => setImagePrompts(prev => ({ ...prev, extractScene: e.target.value }))}
                              onBlur={handleSavePrompts}
                              rows={4}
                            />
                          </div>
                        </div>
                      </Collapse.Panel>
                    </Collapse>
                  </div>
                </Card>
                <ImageGallery
                  images={sceneImages}
                  loading={false}
                  onDelete={handleDelete}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
