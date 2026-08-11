import { useState, useEffect, useCallback } from "react";
import { Select, Button, Space, message, Tooltip } from "antd";
import {
  ReloadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { ollamaListModels, ollamaTestConnection } from "../services/tauri";
import type { OllamaModel, OllamaTestResult } from "../types";

interface OllamaModelSelectProps {
  value?: string;
  onChange?: (value: string) => void;
}

export default function OllamaModelSelect({ value, onChange }: OllamaModelSelectProps) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<OllamaTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ollamaListModels();
      setModels(list);
      if (list.length === 0) {
        message.warning("未发现已安装的模型");
      }
    } catch (e) {
      message.error(`获取模型列表失败: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await ollamaTestConnection();
      setTestResult(result);
    } catch (e) {
      setTestResult({
        connected: false,
        latency_ms: 0,
        error: String(e),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <Space.Compact style={{ width: "100%" }}>
        <Select
          style={{ flex: 1 }}
          value={value}
          onChange={onChange}
          loading={loading}
          placeholder="选择或输入模型名称"
          showSearch
          allowClear
          options={models.map((m) => ({
            value: m.name,
            label: `${m.name} (${m.size})`,
          }))}
          filterOption={(input, option) =>
            (option?.value as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
          }
          // 支持手动输入
          onSearch={(search) => {
            if (search && !models.some((m) => m.name === search)) {
              onChange?.(search);
            }
          }}
        />
        <Tooltip title="刷新模型列表">
          <Button icon={<ReloadOutlined />} onClick={fetchModels} loading={loading} />
        </Tooltip>
      </Space.Compact>

      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <Button
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={handleTest}
          loading={testing}
        >
          测速
        </Button>
        {testResult && (
          <span style={{ fontSize: 13 }}>
            {testResult.connected ? (
              <>
                <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 4 }} />
                <span style={{ color: "#52c41a" }}>已连接</span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>
                  {testResult.latency_ms} ms
                </span>
              </>
            ) : (
              <>
                <CloseCircleOutlined style={{ color: "var(--red)", marginRight: 4 }} />
                <span style={{ color: "var(--red)" }}>
                  {testResult.error || "连接失败"}
                </span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
