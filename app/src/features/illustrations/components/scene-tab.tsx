import { useState } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { useImageStore } from "@/stores/image-store";
import { useConnectionCheck } from "@/hooks/use-connection-check";
import { generateSceneImage, extractSceneDescription } from "@/services/tauri";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageGallery } from "@/components/common/ImageGallery";
import { useImageProgress } from "../hooks/use-image-progress";
import type { ImageResult, ChapterMeta } from "@/types";

export function SceneTab({
  onDelete,
  images,
  chapters,
}: {
  onDelete: (id: string) => void;
  images: ImageResult[];
  chapters: ChapterMeta[];
}) {
  const [sceneChapter, setSceneChapter] = useState<string>("");
  const [sceneDesc, setSceneDesc] = useState("");
  const [sceneMood, setSceneMood] = useState("");
  const [extracting, setExtracting] = useState(false);
  const { progress, loading, run } = useImageProgress();
  const refreshImages = useImageStore((s) => s.refreshImages);
  const { checkConnection } = useConnectionCheck();

  const handleExtract = async () => {
    if (!sceneChapter) return toast.warning("请先选择章节");
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
    if (!sceneChapter) return toast.warning("请选择章节");
    if (!sceneDesc.trim()) return toast.warning("请输入场景描述");
    const ok = await run(() => generateSceneImage(Number(sceneChapter), sceneDesc.trim(), sceneMood.trim()), "生成插图");
    if (ok) refreshImages();
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">生成插图</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ChapterPicker chapters={chapters} value={sceneChapter} onChange={setSceneChapter} onExtract={handleExtract} extracting={extracting} />
          <Field label="场景描述">
            <Textarea rows={3} placeholder="场景描述" value={sceneDesc} onChange={(e) => setSceneDesc(e.target.value)} />
          </Field>
          <Field label="氛围/情绪（选填）">
            <Input placeholder="氛围/情绪" value={sceneMood} onChange={(e) => setSceneMood(e.target.value)} />
          </Field>
          <Button onClick={handleGenerate} loading={loading}>{progress || "生成插图"}</Button>
        </CardContent>
      </Card>
      <ImageGallery images={images} onDelete={onDelete} />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ChapterPicker({
  chapters,
  value,
  onChange,
  onExtract,
  extracting,
}: {
  chapters: ChapterMeta[];
  value: string;
  onChange: (v: string) => void;
  onExtract: () => void;
  extracting: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
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
      <Button variant="outline" onClick={onExtract} loading={extracting}>
        <Zap className="mr-1.5 h-3.5 w-3.5" />
        AI 提取场景
      </Button>
    </div>
  );
}
