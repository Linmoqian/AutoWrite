import { useState, useEffect, useRef } from "react";
import { Zap, Image as ImageIcon, User, Camera } from "lucide-react";
import { toast } from "sonner";
import { useImageStore } from "@/stores/image-store";
import { useNovelStore } from "@/stores/novel-store";
import { useConnectionCheck } from "@/hooks/use-connection-check";
import {
  generateCover,
  generateCharacterImage,
  generateSceneImage,
  extractSceneDescription,
  deleteImage,
  onImageProgress,
} from "@/services/tauri";
import type { ImageKind, ImageProgressEvent } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageGallery } from "@/components/common/ImageGallery";

const STAGE_LABELS: Record<ImageProgressEvent["stage"], string> = {
  preparing: "准备中...",
  submitting: "提交任务中...",
  polling: "生成中...",
  downloading: "下载中...",
  saving: "保存中...",
  done: "完成",
};

export default function Illustrations() {
  const images = useImageStore((s) => s.images);
  const refreshImages = useImageStore((s) => s.refreshImages);
  const chapters = useNovelStore((s) => s.chapters);
  const refreshChapters = useNovelStore((s) => s.refreshChapters);

  const [activeTab, setActiveTab] = useState<ImageKind>("cover");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    refreshImages();
    refreshChapters();
    return () => {
      mountedRef.current = false;
    };
  }, [refreshImages, refreshChapters]);

  const handleDelete = async (id: string) => {
    try {
      await deleteImage(id);
      toast.success("已删除");
      refreshImages();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const coverImages = images.filter((i) => i.kind === "cover");
  const charImages = images.filter((i) => i.kind === "character");
  const sceneImages = images.filter((i) => i.kind === "scene");

  return (
    <div className="fade-in">
      <h1 className="page-title">小说配图</h1>

      <Tabs
        value={activeTab}
        onValueChange={(v: string) => setActiveTab(v as ImageKind)}
      >
        <TabsList>
          <TabsTrigger value="cover">
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
            封面
          </TabsTrigger>
          <TabsTrigger value="character">
            <User className="mr-1.5 h-3.5 w-3.5" />
            角色立绘
          </TabsTrigger>
          <TabsTrigger value="scene">
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            场景插图
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cover" className="mt-4">
          <CoverTab onDelete={handleDelete} images={coverImages} />
        </TabsContent>
        <TabsContent value="character" className="mt-4">
          <CharacterTab onDelete={handleDelete} images={charImages} />
        </TabsContent>
        <TabsContent value="scene" className="mt-4">
          <SceneTab
            onDelete={handleDelete}
            images={sceneImages}
            chapters={chapters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useImageProgress() {
  const [progress, setProgress] = useState("");
  const [loading, setLoading] = useState(false);
  const { checkConnection } = useConnectionCheck();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = async (
    fn: () => Promise<unknown>,
    label: string,
  ): Promise<boolean> => {
    if (!(await checkConnection())) return false;
    setLoading(true);
    setProgress(`准备${label}...`);
    const unlisten = await onImageProgress((e: ImageProgressEvent) => {
      setProgress(e.message || STAGE_LABELS[e.stage]);
    });
    try {
      await fn();
      toast.success(`${label}完成`);
      return true;
    } catch (e) {
      toast.error(String(e));
      return false;
    } finally {
      unlisten();
      if (mountedRef.current) {
        setLoading(false);
        setProgress("");
      }
    }
  };

  return { progress, loading, run };
}

function CoverTab({
  onDelete,
  images,
}: {
  onDelete: (id: string) => void;
  images: ReturnType<typeof useImageStore.getState>["images"];
}) {
  const { progress, loading, run } = useImageProgress();
  const refreshImages = useImageStore((s) => s.refreshImages);

  const handleGenerate = async () => {
    const ok = await run(() => generateCover(), "生成封面");
    if (ok) refreshImages();
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">生成封面</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} loading={loading}>
            {progress || "生成封面"}
          </Button>
        </CardContent>
      </Card>
      <ImageGallery images={images} onDelete={onDelete} />
    </>
  );
}

function CharacterTab({
  onDelete,
  images,
}: {
  onDelete: (id: string) => void;
  images: ReturnType<typeof useImageStore.getState>["images"];
}) {
  const [charName, setCharName] = useState("");
  const [charDesc, setCharDesc] = useState("");
  const { progress, loading, run } = useImageProgress();
  const refreshImages = useImageStore((s) => s.refreshImages);

  const handleGenerate = async () => {
    if (!charName.trim()) {
      toast.warning("请输入角色名称");
      return;
    }
    const ok = await run(
      () => generateCharacterImage(charName.trim(), charDesc.trim()),
      "生成立绘",
    );
    if (ok) refreshImages();
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">生成立绘</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>角色名称（必填）</Label>
            <Input
              placeholder="角色名称"
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>角色外貌描述（选填）</Label>
            <Textarea
              rows={3}
              placeholder="角色外貌描述"
              value={charDesc}
              onChange={(e) => setCharDesc(e.target.value)}
            />
          </div>
          <Button onClick={handleGenerate} loading={loading}>
            {progress || "生成立绘"}
          </Button>
        </CardContent>
      </Card>
      <ImageGallery images={images} onDelete={onDelete} />
    </>
  );
}

function SceneTab({
  onDelete,
  images,
  chapters,
}: {
  onDelete: (id: string) => void;
  images: ReturnType<typeof useImageStore.getState>["images"];
  chapters: ReturnType<typeof useNovelStore.getState>["chapters"];
}) {
  const [sceneChapter, setSceneChapter] = useState<string>("");
  const [sceneDesc, setSceneDesc] = useState("");
  const [sceneMood, setSceneMood] = useState("");
  const [extracting, setExtracting] = useState(false);
  const { progress, loading, run } = useImageProgress();
  const refreshImages = useImageStore((s) => s.refreshImages);
  const { checkConnection } = useConnectionCheck();

  const handleExtract = async () => {
    if (!sceneChapter) {
      toast.warning("请先选择章节");
      return;
    }
    if (!(await checkConnection())) return;
    setExtracting(true);
    try {
      const result = await extractSceneDescription(Number(sceneChapter));
      setSceneDesc(result.sceneDesc);
      setSceneMood(result.mood);
      toast.success("场景提取完成");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!sceneChapter) {
      toast.warning("请选择章节");
      return;
    }
    if (!sceneDesc.trim()) {
      toast.warning("请输入场景描述");
      return;
    }
    const ok = await run(
      () =>
        generateSceneImage(
          Number(sceneChapter),
          sceneDesc.trim(),
          sceneMood.trim(),
        ),
      "生成插图",
    );
    if (ok) refreshImages();
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">生成插图</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={sceneChapter} onValueChange={setSceneChapter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="选择章节" />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((ch) => (
                  <SelectItem key={ch.filename} value={String(ch.number)}>
                    第{ch.number}章 {ch.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleExtract}
              loading={extracting}
            >
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              AI 提取场景
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>场景描述</Label>
            <Textarea
              rows={3}
              placeholder="场景描述"
              value={sceneDesc}
              onChange={(e) => setSceneDesc(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>氛围/情绪（选填）</Label>
            <Input
              placeholder="氛围/情绪"
              value={sceneMood}
              onChange={(e) => setSceneMood(e.target.value)}
            />
          </div>
          <Button onClick={handleGenerate} loading={loading}>
            {progress || "生成插图"}
          </Button>
        </CardContent>
      </Card>
      <ImageGallery images={images} onDelete={onDelete} />
    </>
  );
}
