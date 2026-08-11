import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PenLine, AlertTriangle } from "lucide-react";
import { createNovel } from "@/services/tauri";
import { useAppStore } from "@/stores/app-store";
import { useConfigStore } from "@/stores/config-store";
import { GENRE_OPTIONS } from "@/lib/constants";
import type { Prompts } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const schema = z.object({
  title: z.string().min(1, "请输入标题"),
  genre: z.string().min(1, "请选择类型"),
  theme: z.string().min(1, "请输入主题"),
  chapters: z.number().min(10, "最少 10 章").max(1000, "最多 1000 章"),
});

type FormData = z.infer<typeof schema>;

export default function CreateNovel() {
  const navigate = useNavigate();
  const existingNovel = useAppStore((s) => s.novelStatus);
  const refreshStatus = useAppStore((s) => s.refreshStatus);
  const config = useConfigStore((s) => s.config);
  const [loading, setLoading] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormData | null>(null);
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [promptsOpen, setPromptsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      genre: "玄幻",
      theme: "修仙",
      chapters: 100,
    },
  });

  const genreValue = watch("genre");

  useEffect(() => {
    if (config?.prompts) setPrompts(config.prompts);
  }, [config]);

  const doCreate = async (values: FormData, overwrite: boolean) => {
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

  const onSubmit = (values: FormData) => doCreate(values, false);

  const handleOverwrite = () => {
    if (!pendingValues) return;
    setPendingValues(null);
    doCreate(pendingValues, true);
  };

  const progressPercent = existingNovel
    ? existingNovel.totalChapters > 0
      ? Math.round((existingNovel.writtenChapters / existingNovel.totalChapters) * 100)
      : 0
    : 0;

  return (
    <div className="fade-in mx-auto max-w-[720px]">
      <h1 className="page-title">创建新小说</h1>

      {existingNovel && (
        <Card
          className="mb-4 cursor-pointer transition-colors hover:border-primary/30"
          onClick={() => navigate("/")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {existingNovel.novel.title}
                </span>
                <Badge variant="secondary">{existingNovel.novel.genre}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {existingNovel.novel.theme}
              </span>
            </div>
            <div className="mt-3">
              <Progress value={progressPercent} className="h-1.5" />
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {existingNovel.writtenChapters} / {existingNovel.totalChapters} 章
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">点击查看详情</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">小说标题</Label>
              <Input id="title" placeholder="如：逆天剑尊" {...register("title")} />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>类型</Label>
              <Select
                value={genreValue}
                onValueChange={(v: string) => setValue("genre", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENRE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.genre && (
                <p className="text-xs text-destructive">{errors.genre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">主题</Label>
              <Input id="theme" placeholder="如：逆天改命、修仙" {...register("theme")} />
              {errors.theme && (
                <p className="text-xs text-destructive">{errors.theme.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="chapters">目标章节数</Label>
              <Input
                id="chapters"
                type="number"
                min={10}
                max={1000}
                {...register("chapters", { valueAsNumber: true })}
              />
              {errors.chapters && (
                <p className="text-xs text-destructive">{errors.chapters.message}</p>
              )}
            </div>

            <Button type="submit" loading={loading} className="w-full">
              <PenLine className="mr-1.5 h-4 w-4" />
              开始创作
            </Button>
          </form>
        </CardContent>
      </Card>

      {prompts && (
        <Card className="mt-4">
          <Collapsible open={promptsOpen} onOpenChange={setPromptsOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between p-4 text-left">
                <span className="text-sm font-medium text-foreground">
                  提示词模板（高级，可选自定义）
                </span>
                <span className="text-xs text-muted-foreground">
                  {promptsOpen ? "收起" : "展开"}
                </span>
              </button>
            </CollapsibleTrigger>
            <Separator />
            <CollapsibleContent>
              <div className="space-y-4 p-4">
                <PromptField
                  label="世界观提示词"
                  value={prompts.worldView}
                  onChange={(v) => setPrompts({ ...prompts, worldView: v })}
                />
                <PromptField
                  label="角色提示词"
                  value={prompts.characters}
                  onChange={(v) => setPrompts({ ...prompts, characters: v })}
                />
                <PromptField
                  label="大纲提示词"
                  value={prompts.outline}
                  onChange={(v) => setPrompts({ ...prompts, outline: v })}
                />
                <PromptField
                  label="章节提示词"
                  value={prompts.chapter}
                  onChange={(v) => setPrompts({ ...prompts, chapter: v })}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      <AlertDialog open={!!pendingValues} onOpenChange={(o: boolean) => !o && setPendingValues(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              目录下已有小说
            </AlertDialogTitle>
            <AlertDialogDescription>
              当前目录下已经存在小说，覆盖后将丢失所有已有内容（大纲、章节、记忆等）。
              <br />
              建议先在设置中选择一个新目录，再创建新小说。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverwrite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              覆盖并创建
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PromptField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
