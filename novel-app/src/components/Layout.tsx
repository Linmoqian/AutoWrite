import { useState, useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout as AntLayout, Menu, Typography, Button, Space } from "antd";
import {
  BookOutlined,
  PlusOutlined,
  OrderedListOutlined,
  ReadOutlined,
  SettingOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { getNovelDir, selectNovelDir } from "../services/tauri";

const { Sider, Content, Header } = AntLayout;
const { Text } = Typography;

const menuItems = [
  { key: "/", icon: <BookOutlined />, label: "仪表盘" },
  { key: "/create", icon: <PlusOutlined />, label: "创建小说" },
  { key: "/outline", icon: <OrderedListOutlined />, label: "大纲管理" },
  { key: "/chapters", icon: <ReadOutlined />, label: "章节管理" },
  { key: "/settings", icon: <SettingOutlined />, label: "设置" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dir, setDir] = useState<string | null>(null);

  useEffect(() => {
    getNovelDir().then(setDir);
  }, []);

  const handleSelectDir = async () => {
    const selected = await selectNovelDir();
    setDir(selected);
  };

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Sider width={200} theme="light">
        <div style={{ padding: "16px", textAlign: "center" }}>
          <Text strong style={{ fontSize: 16 }}>AI 小说创作</Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Text type="secondary">
            {dir || "未选择目录"}
          </Text>
          <Space>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={handleSelectDir}
              size="small"
            >
              选择目录
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: "#fff", borderRadius: 8 }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
