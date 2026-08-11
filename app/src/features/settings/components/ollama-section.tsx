import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { ollamaListModels, ollamaTestConnection } from "@/services/tauri";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppConfig, OllamaModel } from "@/types";
import { FormField } from "./form-field";

export function OllamaSection({
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
      setModels(await ollamaListModels());
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
          <Button variant="outline" size="sm" onClick={testConn}>测试连接</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Ollama 地址">
          <Input placeholder="http://localhost:11434" value={ollama.apiUrl} onChange={(e) => setField("apiUrl", e.target.value)} />
        </FormField>
        <ModelPicker models={models} value={ollama.model} loadingModels={loadingModels} onChange={(v) => setField("model", v)} onRefresh={refreshModels} />
        <FormField label="上下文窗口 (tokens)">
          <Input type="number" min={2048} max={262144} step={4096} value={ollama.numCtx} onChange={(e) => setField("numCtx", Number(e.target.value))} />
        </FormField>
        <FormField label="超时时间（秒）">
          <Input type="number" min={60} max={1200} value={ollama.timeout} onChange={(e) => setField("timeout", Number(e.target.value))} />
        </FormField>
      </CardContent>
    </Card>
  );
}

function ModelPicker({
  models,
  value,
  loadingModels,
  onChange,
  onRefresh,
}: {
  models: OllamaModel[];
  value: string;
  loadingModels: boolean;
  onChange: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">模型</span>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="选择或输入模型" /></SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.name} value={m.name}>{m.name} ({m.size})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loadingModels}>
          <RefreshCw className={cn("h-4 w-4", loadingModels && "animate-spin")} />
        </Button>
      </div>
      {models.length === 0 && <p className="text-xs text-muted-foreground">点击刷新按钮获取可用模型列表</p>}
    </div>
  );
}
