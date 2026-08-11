import { useImageStore } from "@/stores/image-store";
import { generateCover } from "@/services/tauri";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageGallery } from "@/components/common/ImageGallery";
import { useImageProgress } from "../hooks/use-image-progress";
import type { ImageResult } from "@/types";

export function CoverTab({
  onDelete,
  images,
}: {
  onDelete: (id: string) => void;
  images: ImageResult[];
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
