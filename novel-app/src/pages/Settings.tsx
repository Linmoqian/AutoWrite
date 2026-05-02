import { useState, useEffect } from "react";
import { Form, Input, InputNumber, Card, Typography, message, Collapse } from "antd";
import { loadConfig, saveConfig } from "../services/tauri";
import type { AppConfig } from "../types";
import LoadingButton from "../components/LoadingButton";

const { Title } = Typography;

export default function Settings() {
  const [form] = Form.useForm<AppConfig>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig().then((config) => form.setFieldsValue(config));
  }, [form]);

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
    <div style={{ maxWidth: 700 }}>
      <Title level={3}>设置</Title>
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Card title="模型配置" style={{ marginBottom: 16 }}>
          <Form.Item name="model" label="Ollama 模型" rules={[{ required: true }]}>
            <Input placeholder="如：qwen3:8b, deepseek-r1:7b" />
          </Form.Item>
          <Form.Item name="ollama_url" label="Ollama 地址" rules={[{ required: true }]}>
            <Input placeholder="http://localhost:11434" />
          </Form.Item>
          <Form.Item name="timeout" label="超时时间（秒）" rules={[{ required: true }]}>
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
