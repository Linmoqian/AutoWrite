import {
  Cloud,
  Laptop,
  Save,
  CircleHelp,
  Loader2,
  CircleCheck,
  Sparkles,
  Gem,
  Cpu,
} from "lucide-react";
import { TOUR_KEY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import type { Provider } from "@/types";
import { useSettings } from "./hooks/use-settings";
import { ProviderCard } from "./components/provider-card";
import { OpenAiSection } from "./components/openai-section";
import { OllamaSection } from "./components/ollama-section";
import { ImageSection } from "./components/image-section";

// 复用 openai 配置段（apiKey/apiUrl/model/timeout）的 provider 集合。
const API_PROVIDERS: Provider[] = ["openai", "claude", "gemini", "llamacpp"];

export default function Settings() {
  const { config, saving, saved, update, handleSave } = useSettings();

  if (!config) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const usesOpenAiSection = API_PROVIDERS.includes(config.provider);

  return (
    <div className="fade-in mx-auto max-w-[720px]">
      <h1 className="page-title">模型配置</h1>

      {/* Provider 选择：5 个选项，响应式网格 */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ProviderCard
          selected={config.provider === "openai"}
          onClick={() => update("provider", "openai" as Provider)}
          title="OpenAI 兼容"
          description="DeepSeek、OpenAI、月之暗面等"
          icon={<Cloud className="h-6 w-6" />}
        />
        <ProviderCard
          selected={config.provider === "claude"}
          onClick={() => update("provider", "claude" as Provider)}
          title="Claude"
          description="Anthropic 原生 API"
          icon={<Sparkles className="h-6 w-6" />}
        />
        <ProviderCard
          selected={config.provider === "gemini"}
          onClick={() => update("provider", "gemini" as Provider)}
          title="Gemini"
          description="Google AI API"
          icon={<Gem className="h-6 w-6" />}
        />
        <ProviderCard
          selected={config.provider === "llamacpp"}
          onClick={() => update("provider", "llamacpp" as Provider)}
          title="llama.cpp"
          description="本地 llama-server"
          icon={<Cpu className="h-6 w-6" />}
        />
        <ProviderCard
          selected={config.provider === "ollama"}
          onClick={() => update("provider", "ollama" as Provider)}
          title="Ollama"
          description="本地或局域网运行"
          icon={<Laptop className="h-6 w-6" />}
        />
      </div>

      {usesOpenAiSection ? (
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
