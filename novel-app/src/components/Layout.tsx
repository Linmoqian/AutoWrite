import { useState, useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout as AntLayout, Menu, Button } from "antd";
import {
  BookOutlined,
  PlusOutlined,
  OrderedListOutlined,
  ReadOutlined,
  SettingOutlined,
  FolderOpenOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import { getNovelDir, selectNovelDir } from "../services/tauri";

const { Sider, Content, Header } = AntLayout;

const menuItems = [
  { key: "/", icon: <BookOutlined />, label: "仪表盘" },
  { key: "/create", icon: <PlusOutlined />, label: "创建小说" },
  { key: "/outline", icon: <OrderedListOutlined />, label: "大纲管理" },
  { key: "/chapters", icon: <ReadOutlined />, label: "章节管理" },
  { key: "/export", icon: <ExportOutlined />, label: "导出小说" },
  { key: "/settings", icon: <SettingOutlined />, label: "模型配置" },
];

const FULL_WIDTH_ROUTES = ["/chapters"];

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

  const fullWidth = FULL_WIDTH_ROUTES.includes(location.pathname);

  return (
    <AntLayout style={{ height: "100vh", overflow: "hidden" }}>
      <Sider
        width={200}
        style={{
          overflow: "auto",
          height: "100vh",
          position: "sticky",
          top: 0,
          left: 0,
        }}
      >
        <div
          style={{
            padding: "20px 16px 8px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: '"KaiTi", "楷体", serif',
              fontSize: 20,
              color: "var(--gold)",
              letterSpacing: 4,
              fontWeight: "normal",
            }}
          >
            小说大批发
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 4,
              letterSpacing: 1,
            }}
          >
            全自动小说创作！
          </div>
        </div>
        <div
          style={{
            height: 1,
            background: "var(--border)",
            margin: "8px 20px 12px",
          }}
        />
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout style={{ overflow: "hidden" }}>
        <Header
          style={{
            background: "var(--bg-primary)",
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border)",
            height: 48,
            lineHeight: "48px",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {dir ? (
              <>
                <FolderOpenOutlined style={{ marginRight: 6 }} />
                {dir}
              </>
            ) : (
              "未选择目录"
            )}
          </span>
          <Button
            size="small"
            onClick={handleSelectDir}
            icon={<FolderOpenOutlined />}
          >
            选择目录
          </Button>
        </Header>
        <Content
          style={{
            margin: fullWidth ? 24 : "24px auto",
            padding: fullWidth ? "20px 28px" : "28px 36px",
            maxWidth: fullWidth ? "none" : 1100,
            width: "100%",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
