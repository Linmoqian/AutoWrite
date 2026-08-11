import { useState, useEffect } from "react";
import {
  Cloud,
  Laptop,
  Image as ImageIcon,
  Plus,
  Trash2,
  Save,
  CircleHelp,
  RefreshCw,
  Loader2,
  CircleCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/config-store";
import {
  ollamaListModels,
  ollamaTestConnection,
} from "@/services/tauri";
import { PROVIDER_PRESETS, IMAGE_SIZES, TOUR_KEY } from "@/lib/constants";
import type { AppConfig, Provider, LoraConfig, OllamaModel } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function Settings() {
  const storeConfig = useConfigStore((s) => s.config);
  const refreshConfig = useConfigStore((s) => s.refreshConfig);
  const saveConfigAction = useConfigStore((s) => s.saveConfigAction);
  const saved = useConfigStore((s) => s.saved);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    if (storeConfig) setConfig(storeConfig);
  }, [storeConfig]);

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) =>
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    const ok = await saveConfigAction(config);
    setSaving(false);
    if (ok) toast.success("配置已保存");
    else toast.error("保存失败");
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fade-in mx-auto max-w-[720px]">
      <h1 className="page-title">模型配置</h1>

      {/* Provider selection */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <ProviderCard
          selected={config.provider === "openai"}
          onClick={() => update("provider", "openai" as Provider)}
          title="OpenAI 兼容 API"
          description="DeepSeek、OpenAI、月之暗面等"
          icon={<Cloud className="h-6 w-6" />}
        />
        <ProviderCard
          selected={config.provider === "ollama"}
          onClick={() => update("provider", "ollama" as Provider)}
          title="Ollama 本地模型"
          description="本地或局域网运行"
          icon={<Laptop className="h-6 w-6" />}
        />
      </div>

      {config.provider === "openai" ? (
        <OpenAiSection config={config} update={update} />
      ) : (
        <OllamaSection config={config} update={update} />
      )}

      <ImageSection config={config} update={update} />

      {/* Save bar */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <Button onClick={handleSave} loading={saving}>
          <Save className="mr-1.5 h-4 w-4" />
          保存配置
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            localStorage.removeItem(TOUR_KEY);
            window.location.reload();
          }}
        >
          <CircleHelp className="mr-1.5 h-3.5 w-3.5" />
          重新显示新手引导
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-success">
            <CircleCheck className="h-4 w-4" />
            已保存
          </span>
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  selected,
  onClick,
  title,
  description,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border-2 p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/30"
      )}
    >
      <div className={cn("mb-2", selected ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

function OpenAiSection({
  config,
  update,
}: {
  config: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}) {
  const openai = config.openai;
  const setField = (field: keyof typeof openai, value: string | number) =>
    update("openai", { ...openai, [field]: value });

  const onPresetChange = (preset: string) => {
    const p = PROVIDER_PRESETS[preset];
    if (p && preset !== "custom") {
      setField("model", p.model);
      setField("apiUrl", p.url);
    }
  };

  return (
    <Card className="mb-5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">OpenAI 兼容 API 配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>快速配置</Label>
          <Select onValueChange={onPresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择预设服务商" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                <SelectItem key={key} value={key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FormField label="API Key">
          <Input
            type="password"
            placeholder="sk-..."
            value={openai.apiKey}
            onChange={(e) => setField("apiKey", e.target.value)}
          />
        </FormField>
        <FormField label="API 地址">
          <Input
            placeholder="https://api.deepseek.com"
            value={openai.apiUrl}
            onChange={(e) => setField("apiUrl", e.target.value)}
          />
        </FormField>
        <FormField label="模型名称">
          <Input
            placeholder="deepseek-chat"
            value={openai.model}
            onChange={(e) => setField("model", e.target.value)}
          />
        </FormField>
        <FormField label="超时时间（秒）">
          <Input
            type="number"
            min={60}
            max={1200}
            value={openai.timeout}
            onChange={(e) => setField("timeout", Number(e.target.value))}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}

function OllamaSection({
  config,
  update,
}: {
  config: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}) {
  const ollama = config.ollama;
  const setField = (field: keyof typeof ollama, value: string | number) =>
    update("ollama", { ...ollama, [field]: value });
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const refreshModels = async () => {
    setLoadingModels(true);
    try {
      const list = await ollamaListModels();
      setModels(list);
    } catch (e) {
      toast.error(`获取模型列表失败: ${e}`);
    } finally {
      setLoadingModels(false);
    }
  };

  const testConn = async () => {
    try {
      const result = await ollamaTestConnection();
      if (result.connected) {
        toast.success(`连接成功（${result.latencyMs}ms）`);
        refreshModels();
      } else {
        toast.error(result.error || "连接失败");
      }
    } catch (e) {
      toast.error(`连接失败: ${e}`);
    }
  };

  return (
    <Card className="mb-5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Ollama 本地模型配置</CardTitle>
          <Button variant="outline" size="sm" onClick={testConn}>
            测试连接
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Ollama 地址">
          <Input
            placeholder="http://localhost:11434"
            value={ollama.apiUrl}
            onChange={(e) => setField("apiUrl", e.target.value)}
          />
        </FormField>
        <div className="space-y-1.5">
          <Label>模型</Label>
          <div className="flex gap-2">
            <Select
              value={ollama.model}
              onValueChange={(v: string) => setField("model", v)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="选择或输入模型" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.name} value={m.name}>
                    {m.name} ({m.size})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refreshModels} disabled={loadingModels}>
              <RefreshCw className={cn("h-4 w-4", loadingModels && "animate-spin")} />
            </Button>
          </div>
          {models.length === 0 && (
            <p className="text-xs text-muted-foreground">点击刷新按钮获取可用模型列表</p>
          )}
        </div>
        <FormField label="上下文窗口 (tokens)">
          <Input
            type="number"
            min={2048}
            max={262144}
            step={4096}
            value={ollama.numCtx}
            onChange={(e) => setField("numCtx", Number(e.target.value))}
          />
        </FormField>
        <FormField label="超时时间（秒）">
          <Input
            type="number"
            min={60}
            max={1200}
            value={ollama.timeout}
            onChange={(e) => setField("timeout", Number(e.target.value))}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}

function ImageSection({
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
    update("image", {
      ...image,
      loras: [...image.loras, { name: "", weight: 0.5 } as LoraConfig],
    });
  };

  const updateLora = (idx: number, field: keyof LoraConfig, value: string | number) => {
    const loras = image.loras.map((l, i) =>
      i === idx ? { ...l, [field]: value } : l
    );
    update("image", { ...image, loras });
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
          <Input
            placeholder="Tongyi-MAI/Z-Image-Turbo"
            value={image.model}
            onChange={(e) => setField("model", e.target.value)}
          />
        </FormField>
        <FormField label="ModelScope API 地址">
          <Input
            placeholder="https://api-inference.modelscope.cn"
            value={image.apiUrl}
            onChange={(e) => setField("apiUrl", e.target.value)}
          />
        </FormField>
        <FormField label="ModelScope API Token">
          <Input
            type="password"
            placeholder="输入 ModelScope API Token"
            value={image.apiToken}
            onChange={(e) => setField("apiToken", e.target.value)}
          />
        </FormField>
        <div className="space-y-1.5">
          <Label>图片尺寸</Label>
          <Select value={image.size} onValueChange={(v: string) => setField("size", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>LoRA 配置（可选）</Label>
          {image.loras.map((lora, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                placeholder="LoRA 名称（如 user/lora-repo）"
                value={lora.name}
                onChange={(e) => updateLora(idx, "name", e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                placeholder="权重"
                value={lora.weight}
                onChange={(e) => updateLora(idx, "weight", Number(e.target.value))}
                className="w-24"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeLora(idx)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {image.loras.length < 6 && (
            <Button variant="outline" size="sm" onClick={addLora}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              添加 LoRA
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            最多 6 个 LoRA，权重总和应为 1.0
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
