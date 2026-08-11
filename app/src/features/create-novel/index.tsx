import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createNovel } from "@/services/tauri";
import { useAppStore } from "@/stores/app-store";
import { useConfigStore } from "@/stores/config-store";
import type { Prompts } from "@/types";
import { ExistingNovelCard } from "./components/existing-novel-card";
import { NovelForm, type NovelFormValues } from "./components/novel-form";
import { OverwriteDialog } from "./components/overwrite-dialog";
import { PromptsPanel } from "./components/prompts-panel";

export default function CreateNovel() {
  const navigate = useNavigate();
  const existingNovel = useAppStore((s) => s.novelStatus);
  const refreshStatus = useAppStore((s) => s.refreshStatus);
  const config = useConfigStore((s) => s.config);
  const [loading, setLoading] = useState(false);
  const [pendingValues, setPendingValues] = useState<NovelFormValues | null>(null);
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [promptsOpen, setPromptsOpen] = useState(false);

  useEffect(() => {
    if (config?.prompts) setPrompts(config.prompts);
  }, [config]);

  const doCreate = async (values: NovelFormValues, overwrite: boolean) => {
    setLoading(true);
    try {
      await createNovel(
        values.title,
        values.genre,
        values.theme,
        values.chapters,
        overwrite,
        promptsOpen ? prompts ?? undefined : undefined,
      );
      toast.success("小说创建成功");
      await refreshStatus();
      navigate("/");
    } catch (e: unknown) {
      const msg = String(e);
      if (msg.includes("已有小说")) {
        setPendingValues(values);
      } else {
        toast.error(`创建失败: ${e}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOverwrite = () => {
    if (!pendingValues) return;
    setPendingValues(null);
    doCreate(pendingValues, true);
  };

  return (
    <div className="fade-in mx-auto max-w-[720px]">
      <h1 className="page-title">创建新小说</h1>

      {existingNovel && (
        <ExistingNovelCard status={existingNovel} onClick={() => navigate("/")} />
      )}

      <NovelForm
        loading={loading}
        onSubmit={(values) => doCreate(values, false)}
      />

      {prompts && (
        <PromptsPanel
          prompts={prompts}
          open={promptsOpen}
          onOpenChange={setPromptsOpen}
          onChange={setPrompts}
        />
      )}

      <OverwriteDialog
        open={!!pendingValues}
        onOpenChange={(open) => !open && setPendingValues(null)}
        onConfirm={handleOverwrite}
      />
    </div>
  );
}
