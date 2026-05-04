import { useState, useEffect } from "react";
import { Form, Input, InputNumber, Select, message } from "antd";
import {
  CheckCircleOutlined,
  CloudOutlined,
  LaptopOutlined,
} from "@ant-design/icons";
import { loadConfig, saveConfig } from "../services/tauri";
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
  const [form] = Form.useForm<AppConfig>();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [provider, setProvider] = useState<Provider>("openai");
  const [savedConfig, setSavedConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    loadConfig().then((config) => {
      setSavedConfig(config);
      form.setFieldsValue(config);
      setProvider(config.provider || "openai");
    });
  }, [form]);

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
    <div className="fade-in" style={{ maxWidth: 700, margin: "0 auto" }}>
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
              name="timeout"
              label="超时时间（秒）"
              rules={[{ required: true }]}
            >
              <InputNumber min={60} max={1200} style={{ width: "100%" }} />
            </Form.Item>
          </ProviderCard>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LoadingButton type="primary" htmlType="submit" loading={loading}>
            保存配置
          </LoadingButton>
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
