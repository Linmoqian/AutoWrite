import { useState } from "react";
import { toast } from "sonner";
import { useImageStore } from "@/stores/image-store";
import { generateCharacterImage } from "@/services/tauri";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageGallery } from "@/components/common/ImageGallery";
import { useImageProgress } from "../hooks/use-image-progress";
import type { ImageResult } from "@/types";

export function CharacterTab({
  onDelete,
  images,
}: {
  onDelete: (id: string) => void;
  images: ImageResult[];
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
