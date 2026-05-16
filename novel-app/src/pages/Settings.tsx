import { useState, useEffect } from "react";
import { Card, Form, Input, InputNumber, Select, Button, Collapse, message } from "antd";
import {
  CheckCircleOutlined,
  CloudOutlined,
  LaptopOutlined,
  PictureOutlined,
  PlusOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

import { saveConfig } from "../services/tauri";
import { useApp } from "../contexts/AppContext";

import type { AppConfig, Provider } from "../types";
import LoadingButton from "../components/LoadingButton";
import ProviderCard from "../components/ProviderCard";
import OllamaModelSelect from "../components/OllamaModelSelect";

const PROVIDER_PRESETS: Record<string, { label: string; model: string; url: string }> = {
  deepseek: { label: "DeepSeek", model: "deepseek-chat", url: "https://api.deepseek.com" },
  openai: { label: "OpenAI", model: "gpt-4o-mini", url: "https://api.openai.com" },
  moonshot: { label: "月之暗面", model: "moonshot-v1-8k", url: "https://api.moonshot.cn" },
  qwen: { label: "通义千问", model: "qwen-turbo", url: "https://dashscope.aliyuncs.com/compatible-mode" },
  custom: { label: "自定义", model: "", url: "" },
};

export default function Settings() {
  const { config: contextConfig, refreshConfig } = useApp();
  const [form] = Form.useForm<AppConfig>();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [provider, setProvider] = useState<Provider>("openai");
  const [savedConfig, setSavedConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (contextConfig) {
      setSavedConfig(contextConfig);
      form.setFieldsValue(contextConfig);
      setProvider(contextConfig.provider || "openai");
    }
  }, [contextConfig, form]);

  const onPresetChange = (preset: string) => {
    const p = PROVIDER_PRESETS[preset];
    if (p && preset !== "custom") {
      form.setFieldsValue({ model: p.model, api_base_url: p.url });
    }
  };

  const onSave = async (values: AppConfig) => {
    setLoading(true);
    setSaved(false);
    try {
      const merged = { ...savedConfig, ...values };
      await saveConfig(merged);
      setSavedConfig(merged);
      setSaved(true);
      await refreshConfig();
      message.open({
        type: "success",
        content: "配置已保存",
        duration: 3,
        icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        style: {
          marginTop: "48px",
        },
      });
    } catch (e) {
      message.error(`保存失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSwitch = (p: Provider) => {
    setProvider(p);
    form.setFieldsValue({ provider: p });
  };

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 className="page-title">模型配置</h1>
      <Form form={form} layout="vertical" onFinish={onSave} requiredMark={false}>
        <Form.Item name="provider" hidden>
          <Input />
        </Form.Item>

        <div className="provider-cards-container">
          <ProviderCard
            selected={provider === "openai"}
            onClick={() => handleProviderSwitch("openai")}
            title="OpenAI 兼容 API"
            description="DeepSeek、OpenAI、月之暗面、通义千问等云服务"
            icon={<CloudOutlined />}
          >
            <Form.Item label="快速配置">
              <Select
                placeholder="选择预设服务商"
                onChange={onPresetChange}
                allowClear
              >
                {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                  <Select.Option key={key} value={key}>{p.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="api_key"
              label="API Key"
              rules={[{ required: provider === "openai", message: "请输入 API Key" }]}
            >
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item
              name="api_base_url"
              label="API 地址"
              rules={[{ required: provider === "openai" }]}
            >
              <Input placeholder="https://api.deepseek.com" />
            </Form.Item>
            <Form.Item
              name="model"
              label="模型名称"
              rules={[{ required: provider === "openai" }]}
            >
              <Input placeholder="deepseek-chat" />
            </Form.Item>
            <Form.Item
              name="timeout"
              label="超时时间（秒）"
              rules={[{ required: true }]}
            >
              <InputNumber min={60} max={1200} style={{ width: "100%" }} />
            </Form.Item>
          </ProviderCard>

          <ProviderCard
            selected={provider === "ollama"}
            onClick={() => handleProviderSwitch("ollama")}
            title="Ollama 本地模型"
            description="本地或局域网运行，无需 API Key"
            icon={<LaptopOutlined />}
          >
            <Form.Item
              name="ollama_url"
              label="Ollama 地址"
              rules={[{ required: provider === "ollama" }]}
            >
              <Input placeholder="http://localhost:11434" />
            </Form.Item>
            <Form.Item
              name="ollama_model"
              label="模型"
              rules={[{ required: provider === "ollama" }]}
            >
              <OllamaModelSelect
                value={form.getFieldValue("ollama_model")}
                onChange={(v) => form.setFieldsValue({ ollama_model: v })}
              />
            </Form.Item>
            <Form.Item
              name="num_ctx"
              label="上下文窗口 (tokens)"
              tooltip="越大越能写长文，但占用更多显存。Gemma 4 建议 32768+"
            >
              <InputNumber min={2048} max={262144} step={4096} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="timeout"
              label="超时时间（秒）"
              rules={[{ required: true }]}
            >
              <InputNumber min={60} max={1200} style={{ width: "100%" }} />
            </Form.Item>
          </ProviderCard>
        </div>

        <Card style={{ marginBottom: 20 }} styles={{ body: { padding: 20 } }}>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <PictureOutlined style={{ color: "var(--gold)", fontSize: 18 }} />
            <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
              图片生成配置（魔搭 ModelScope）
            </span>
          </div>
          <Form.Item name="image_model" label="图片模型">
            <Input placeholder="Tongyi-MAI/Z-Image-Turbo" />
          </Form.Item>
          <Form.Item
            name="image_api_base_url"
            label="ModelScope API 地址"
            tooltip="留空则使用默认 ModelScope API 地址"
          >
            <Input placeholder="https://api-inference.modelscope.cn" />
          </Form.Item>
          <Form.Item
            name="image_api_key"
            label="ModelScope API Token"
            tooltip="在 modelscope.cn 注册获取"
          >
            <Input.Password placeholder="输入 ModelScope API Token" />
          </Form.Item>
          <Form.Item name="image_size" label="图片尺寸">
            <Select>
              <Select.Option value="1024x1024">1024 × 1024（正方形）</Select.Option>
              <Select.Option value="1024x1792">1024 × 1792（竖版）</Select.Option>
              <Select.Option value="1792x1024">1792 × 1024（横版）</Select.Option>
            </Select>
          </Form.Item>
          <Collapse
            ghost
            items={[
              {
                key: "lora",
                label: "LoRA 配置（可选）",
                children: (
                  <>
                    <Form.List name={["image_loras", "entries"]}>
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <div key={key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                              <Form.Item
                                {...restField}
                                name={[name, "name"]}
                                style={{ flex: 1, marginBottom: 0 }}
                              >
                                <Input placeholder="LoRA 名称（如 user/lora-repo）" />
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                name={[name, "weight"]}
                                style={{ width: 120, marginBottom: 0 }}
                              >
                                <InputNumber min={0} max={1} step={0.1} placeholder="权重" />
                              </Form.Item>
                              <Button
                                onClick={() => remove(name)}
                                icon={<DeleteOutlined />}
                                danger
                              />
                            </div>
                          ))}
                          {fields.length < 6 && (
                            <Button
                              onClick={() => add()}
                              icon={<PlusOutlined />}
                              type="dashed"
                              block
                            >
                              添加 LoRA
                            </Button>
                          )}
                        </>
                      )}
                    </Form.List>
                    <div style={{ color: "var(--text-tertiary)", fontSize: 12, marginTop: 8 }}>
                      最多 6 个 LoRA，权重总和应为 1.0
                    </div>
                  </>
                ),
              },
            ]}
          />
        </Card>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
          <LoadingButton type="primary" htmlType="submit" loading={loading}>
            保存配置
          </LoadingButton>
          <Button
            icon={<QuestionCircleOutlined />}
            onClick={() => {
              localStorage.removeItem("autowrite_tour_done");
              window.location.reload();
            }}
          >
            重新显示新手引导
          </Button>
          {saved && (
            <span style={{ color: "#52c41a", fontSize: 14 }}>
              <CheckCircleOutlined style={{ marginRight: 4 }} />
              已保存
            </span>
          )}
        </div>
      </Form>
    </div>
  );
}
