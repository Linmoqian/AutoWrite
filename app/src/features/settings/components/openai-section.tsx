import { PROVIDER_PRESETS } from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppConfig } from "@/types";
import { FormField } from "./form-field";

export function OpenAiSection({
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
          <span className="text-sm font-medium">快速配置</span>
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
