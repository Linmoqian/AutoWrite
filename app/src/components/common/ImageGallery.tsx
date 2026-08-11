import { useState } from "react";
import { Trash2, Eye } from "lucide-react";
import type { ImageResult } from "@/types";
import { IMAGE_KIND_LABEL, toDisplayImageUrl } from "@/services/tauri";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ImageGalleryProps {
  images: ImageResult[];
  onDelete: (id: string) => void;
}

export function ImageGallery({ images, onDelete }: ImageGalleryProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        暂无图片
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewSrc(null)}
        >
          <img
            src={previewSrc}
            alt="预览"
            className="max-h-[85vh] max-w-[90vw] rounded-lg"
          />
        </div>
      )}
    </>
  );
}

function ImageCard({
  image,
  onDelete,
  onPreview,
}: {
  image: ImageResult;
  onDelete: (id: string) => void;
  onPreview: (src: string) => void;
}) {
  const src = toDisplayImageUrl(image.filename);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-muted">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="absolute right-1.5 top-1.5 z-10 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除图片</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除此图片？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(image.id)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className="relative aspect-square cursor-pointer overflow-hidden"
        onClick={() => onPreview(src)}
      >
        <img
          src={src}
          alt={image.refText || IMAGE_KIND_LABEL[image.kind]}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
          <Eye className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 p-2">
        <Badge variant="secondary" className="text-[10px]">
          {IMAGE_KIND_LABEL[image.kind]}
        </Badge>
        {image.refText && (
          <span className="truncate text-xs text-muted-foreground">
            {image.refText}
          </span>
        )}
      </div>
    </div>
  );
}
