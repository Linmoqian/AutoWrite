import { useState, useEffect } from "react";
import { Image as ImageIcon, User, Camera } from "lucide-react";
import { toast } from "sonner";
import { useImageStore } from "@/stores/image-store";
import { useNovelStore } from "@/stores/novel-store";
import { deleteImage } from "@/services/tauri";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoverTab } from "./components/cover-tab";
import { CharacterTab } from "./components/character-tab";
import { SceneTab } from "./components/scene-tab";
import type { ImageKind } from "@/types";

export default function Illustrations() {
  const images = useImageStore((s) => s.images);
  const refreshImages = useImageStore((s) => s.refreshImages);
  const chapters = useNovelStore((s) => s.chapters);
  const refreshChapters = useNovelStore((s) => s.refreshChapters);

  const [activeTab, setActiveTab] = useState<ImageKind>("cover");

  useEffect(() => {
    refreshImages();
    refreshChapters();
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
