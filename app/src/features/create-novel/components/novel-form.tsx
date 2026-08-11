import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PenLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENRE_OPTIONS } from "@/lib/constants";

const schema = z.object({
  title: z.string().min(1, "请输入标题"),
  genre: z.string().min(1, "请选择类型"),
  theme: z.string().min(1, "请输入主题"),
  chapters: z.number().min(10, "最少 10 章").max(1000, "最多 1000 章"),
});

export type NovelFormValues = z.infer<typeof schema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function NovelForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (values: NovelFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NovelFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", genre: "玄幻", theme: "修仙", chapters: 100 },
  });

  const genreValue = watch("genre");

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">小说标题</Label>
            <Input id="title" placeholder="如：逆天剑尊" {...register("title")} />
            <FieldError message={errors.title?.message} />
          </div>

          <div className="space-y-2">
            <Label>类型</Label>
            <Select
              value={genreValue}
              onValueChange={(v: string) =>
                setValue("genre", v, { shouldValidate: true })
              }
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
            <FieldError message={errors.genre?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">主题</Label>
            <Input id="theme" placeholder="如：逆天改命、修仙" {...register("theme")} />
            <FieldError message={errors.theme?.message} />
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
            <FieldError message={errors.chapters?.message} />
          </div>

          <Button type="submit" loading={loading} className="w-full">
            <PenLine className="mr-1.5 h-4 w-4" />
            开始创作
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
