export const GENRE_OPTIONS = [
  { value: "玄幻", label: "玄幻" },
  { value: "都市", label: "都市" },
  { value: "科幻", label: "科幻" },
  { value: "历史", label: "历史" },
  { value: "言情", label: "言情" },
  { value: "武侠", label: "武侠" },
  { value: "悬疑", label: "悬疑" },
  { value: "其他", label: "其他" },
] as const;

export const IMAGE_SIZES = [
  { value: "1024x1024", label: "1024 × 1024（正方形）" },
  { value: "1024x1792", label: "1024 × 1792（竖版）" },
  { value: "1792x1024", label: "1792 × 1024（横版）" },
] as const;

export const PROVIDER_PRESETS: Record<
  string,
  { label: string; model: string; url: string }
> = {
  deepseek: {
    label: "DeepSeek",
    model: "deepseek-chat",
    url: "https://api.deepseek.com",
  },
  openai: {
    label: "OpenAI",
    model: "gpt-4o-mini",
    url: "https://api.openai.com",
  },
  moonshot: {
    label: "月之暗面",
    model: "moonshot-v1-8k",
    url: "https://api.moonshot.cn",
  },
  qwen: {
    label: "通义千问",
    model: "qwen-turbo",
    url: "https://dashscope.aliyuncs.com/compatible-mode",
  },
  custom: { label: "自定义", model: "", url: "" },
};

export const TOUR_KEY = "autowrite_tour_done";

export const OUTLINE_STEPS = ["worldView", "characters", "outline"] as const;
export const OUTLINE_STEP_LABELS: Record<string, string> = {
  worldView: "世界观",
  characters: "角色设定",
  outline: "章节大纲",
};
