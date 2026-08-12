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
import type { AppConfig, Provider } from "@/types";
import { FormField } from "./form-field";

// 各 provider 复用 openai 段时的标题与占位符。
// 地址留空时后端会用默认值（见 AppConfig::ai_base_url），此处仅作输入提示。
const SECTION_META: Partial<
  Record<Provider, { title: string; urlPlaceholder: string; modelPlaceholder: string }>
> = {
  openai: {
    title: "OpenAI 兼容 API 配置",
    urlPlaceholder: "https://api.deepseek.com",
    modelPlaceholder: "deepseek-chat",
  },
  claude: {
    title: "Claude (Anthropic) 配置",
    urlPlaceholder: "https://api.anthropic.com",
    modelPlaceholder: "claude-3-5-sonnet-20241022",
  },
  gemini: {
    title: "Gemini (Google) 配置",
    urlPlaceholder: "https://generativelanguage.googleapis.com",
    modelPlaceholder: "gemini-2.0-flash",
  },
  llamacpp: {
    title: "llama.cpp (llama-server) 配置",
    urlPlaceholder: "http://localhost:8080",
    modelPlaceholder: "本地模型名",
  },
};

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

  // 非 openai 的 provider（claude/gemini/llamacpp）也复用本配置段，
  // 按当前 provider 调整标题、占位符与是否显示「快速配置」预设下拉。
  const isPureOpenAi = config.provider === "openai";
  const sectionTitle = SECTION_META[config.provider]?.title ?? "API 配置";
  const urlPlaceholder =
    SECTION_META[config.provider]?.urlPlaceholder ?? "https://api.deepseek.com";
  const modelPlaceholder =
    SECTION_META[config.provider]?.modelPlaceholder ?? "deepseek-chat";

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
        <CardTitle className="text-sm">{sectionTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 仅纯 OpenAI 兼容模式显示服务商预设；Claude/Gemini/llama.cpp 无预设 */}
        {isPureOpenAi && (
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
        )}
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
            placeholder={urlPlaceholder}
            value={openai.apiUrl}
            onChange={(e) => setField("apiUrl", e.target.value)}
          />
        </FormField>
        <FormField label="模型名称">
          <Input
            placeholder={modelPlaceholder}
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
