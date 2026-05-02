import { useState, useEffect } from "react";
import { Collapse, List, Typography, Empty, Spin, message } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { getStatus, generateOutline } from "../services/tauri";
import type { Volume } from "../types";
import LoadingButton from "../components/LoadingButton";

const { Title, Text } = Typography;

export default function Outline() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      const status = await getStatus();
      setVolumes(status.outline);
    } catch (e) {
      message.error(String(e));
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await generateOutline();
      message.success("大纲生成完成");
      refresh();
    } catch (e) {
      message.error(`生成失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" tip="正在生成大纲（世界观 → 角色 → 章节列表）..." />
      </div>
    );
  }

  if (volumes.length === 0) {
    return (
      <div>
        <Title level={3}>大纲管理</Title>
        <Empty description="暂无大纲，请先生成">
          <LoadingButton type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>
            生成大纲
          </LoadingButton>
        </Empty>
      </div>
    );
  }

  const items = volumes.map((vol, idx) => ({
    key: String(idx),
    label: <Text strong>{vol.volume}</Text>,
    children: (
      <List
        size="small"
        dataSource={vol.chapters}
        renderItem={(ch) => (
          <List.Item>
            <Text>{String(ch.num).padStart(3, "0")}. {ch.title}</Text>
          </List.Item>
        )}
      />
    ),
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>大纲管理</Title>
        <LoadingButton type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>
          重新生成
        </LoadingButton>
      </div>
      <Collapse items={items} defaultActiveKey={["0"]} />
    </div>
  );
}
