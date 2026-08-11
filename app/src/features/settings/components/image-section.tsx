import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { IMAGE_SIZES } from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppConfig, LoraConfig } from "@/types";
import { FormField } from "./form-field";

export function ImageSection({
  config,
  update,
}: {
  config: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}) {
  const image = config.image;
  const setField = (field: keyof typeof image, value: string) =>
    update("image", { ...image, [field]: value });

  const addLora = () => {
    if (image.loras.length >= 6) return;
    update("image", { ...image, loras: [...image.loras, { name: "", weight: 0.5 } as LoraConfig] });
  };

  const updateLora = (idx: number, field: keyof LoraConfig, value: string | number) => {
    update("image", { ...image, loras: image.loras.map((l, i) => (i === idx ? { ...l, [field]: value } : l)) });
  };

  const removeLora = (idx: number) => {
    update("image", { ...image, loras: image.loras.filter((_, i) => i !== idx) });
  };

  return (
    <Card className="mb-5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">图片生成配置（魔搭 ModelScope）</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="图片模型">
          <Input placeholder="Tongyi-MAI/Z-Image-Turbo" value={image.model} onChange={(e) => setField("model", e.target.value)} />
        </FormField>
        <FormField label="ModelScope API 地址">
          <Input placeholder="https://api-inference.modelscope.cn" value={image.apiUrl} onChange={(e) => setField("apiUrl", e.target.value)} />
        </FormField>
        <FormField label="ModelScope API Token">
          <Input type="password" placeholder="输入 ModelScope API Token" value={image.apiToken} onChange={(e) => setField("apiToken", e.target.value)} />
        </FormField>
        <SizeSelect value={image.size} onChange={(v) => setField("size", v)} />
        <Separator />
        <LoraList loras={image.loras} onAdd={addLora} onUpdate={updateLora} onRemove={removeLora} />
      </CardContent>
    </Card>
  );
}

function SizeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">图片尺寸</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {IMAGE_SIZES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LoraList({
  loras,
  onAdd,
  onUpdate,
  onRemove,
}: {
  loras: LoraConfig[];
  onAdd: () => void;
  onUpdate: (idx: number, field: keyof LoraConfig, value: string | number) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">LoRA 配置（可选）</span>
      {loras.map((lora, idx) => (
        <div key={idx} className="flex gap-2">
          <Input placeholder="LoRA 名称（如 user/lora-repo）" value={lora.name} onChange={(e) => onUpdate(idx, "name", e.target.value)} className="flex-1" />
          <Input type="number" min={0} max={1} step={0.1} placeholder="权重" value={lora.weight} onChange={(e) => onUpdate(idx, "weight", Number(e.target.value))} className="w-24" />
          <Button variant="outline" size="icon" onClick={() => onRemove(idx)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      {loras.length < 6 && (
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          添加 LoRA
        </Button>
      )}
      <p className="text-xs text-muted-foreground">最多 6 个 LoRA，权重总和应为 1.0</p>
    </div>
  );
}
