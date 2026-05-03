import { useState, useEffect } from "react";
import { Form, Input, InputNumber, Card, Collapse, Select, message } from "antd";
import { loadConfig, saveConfig } from "../services/tauri";
import type { AppConfig, Provider } from "../types";
import LoadingButton from "../components/LoadingButton";

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
  const [provider, setProvider] = useState<Provider>("openai");

  useEffect(() => {
    loadConfig().then((config) => {
      form.setFieldsValue(config);
      setProvider(config.provider || "openai");
    });
  }, [form]);

  const onProviderChange = (value: Provider) => {
    setProvider(value);
    if (value === "ollama") {
      form.setFieldsValue({ model: "deepseek-r1:7b" });
    }
  };

  const onPresetChange = (preset: string) => {
    const p = PROVIDER_PRESETS[preset];
    if (p && preset !== "custom") {
      form.setFieldsValue({ model: p.model, api_base_url: p.url });
    }
  };

  const onSave = async (values: AppConfig) => {
    setLoading(true);
    try {
      await saveConfig(values);
      message.success("配置已保存");
    } catch (e) {
      message.error(`保存失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 700 }}>
      <h1 className="page-title">设置</h1>
      <Form form={form} layout="vertical" onFinish={onSave} requiredMark={false}>
        <Card title="AI 模型" style={{ marginBottom: 16 }}>
          <Form.Item name="provider" label="提供商" rules={[{ required: true }]}>
            <Select onChange={onProviderChange}>
              <Select.Option value="openai">OpenAI 兼容 API</Select.Option>
              <Select.Option value="ollama">Ollama (本地)</Select.Option>
            </Select>
          </Form.Item>

          {provider === "openai" && (
            <>
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
                rules={[{ required: true, message: "请输入 API Key" }]}
              >
                <Input.Password placeholder="sk-..." />
              </Form.Item>
              <Form.Item
                name="api_base_url"
                label="API 地址"
                rules={[{ required: true }]}
              >
                <Input placeholder="https://api.deepseek.com" />
              </Form.Item>
            </>
          )}

          {provider === "ollama" && (
            <Form.Item
              name="ollama_url"
              label="Ollama 地址"
              rules={[{ required: true }]}
            >
              <Input placeholder="http://localhost:11434" />
            </Form.Item>
          )}

          <Form.Item
            name="model"
            label="模型名称"
            rules={[{ required: true }]}
          >
            <Input placeholder={provider === "ollama" ? "qwen3:8b" : "deepseek-chat"} />
          </Form.Item>
          <Form.Item
            name="timeout"
            label="超时时间（秒）"
            rules={[{ required: true }]}
          >
            <InputNumber min={60} max={1200} style={{ width: "100%" }} />
          </Form.Item>
        </Card>

        <Collapse
          items={[
            {
              key: "prompts",
              label: "提示词模板（高级）",
              children: (
                <>
                  <Form.Item name={["prompts", "world"]} label="世界观提示词">
                    <Input.TextArea rows={6} />
                  </Form.Item>
                  <Form.Item name={["prompts", "character"]} label="角色提示词">
                    <Input.TextArea rows={6} />
                  </Form.Item>
                  <Form.Item name={["prompts", "outline"]} label="大纲提示词">
                    <Input.TextArea rows={6} />
                  </Form.Item>
                  <Form.Item name={["prompts", "chapter"]} label="章节提示词">
                    <Input.TextArea rows={6} />
                  </Form.Item>
                </>
              ),
            },
          ]}
          style={{ marginBottom: 16 }}
        />

        <LoadingButton type="primary" htmlType="submit" loading={loading}>
          保存配置
        </LoadingButton>
      </Form>
    </div>
  );
}
