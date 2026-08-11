import { type ReactNode, useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout as AntLayout, Menu, Button, Tour } from "antd";
import type { TourProps } from "antd";
import {
  Book,
  Plus,
  ListOrdered,
  BookOpen,
  Settings,
  FolderOpen,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import { useAppSelector, useAppDispatch } from "../store";
import { selectDir as selectDirThunk } from "../store/appSlice";

const { Sider, Content, Header } = AntLayout;

const TOUR_KEY = "autowrite_tour_done";

const menuItems = [
  { key: "/", icon: <Book size={14} />, label: "仪表盘" },
  { key: "/create", icon: <Plus size={14} />, label: "创建小说" },
  { key: "/outline", icon: <ListOrdered size={14} />, label: "大纲管理" },
  { key: "/chapters", icon: <BookOpen size={14} />, label: "章节管理" },
  { key: "/illustrations", icon: <ImageIcon size={14} />, label: "小说配图" },
  { key: "/export", icon: <Download size={14} />, label: "导出小说" },
  { key: "/settings", icon: <Settings size={14} />, label: "模型配置" },
];

const FULL_WIDTH_ROUTES = ["/chapters"];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dir = useAppSelector((s) => s.app.novelDir);
  const dispatch = useAppDispatch();
  const selectDir = () => dispatch(selectDirThunk());

  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setTourOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setTourOpen(false);
  };

  const steps: TourProps["steps"] = useMemo(
    () => [
      {
        title: "欢迎来到小说大批发",
        description:
          "这是一个全自动 AI 小说创作工具。接下来会带你了解核心操作流程，只需 30 秒。",
      },
      {
        title: "选择小说目录",
        description:
          "首先选择一个本地文件夹，所有小说数据（大纲、章节、配图）都会保存在这里。",
        target: () => document.getElementById("tour-select-dir") as HTMLElement,
        placement: "bottomRight",
      },
      {
        title: "创建小说",
        description:
          "设定小说标题、类型、主题和目标章节数，AI 会根据你的设定进行创作。还可以自定义提示词模板。",
        target: () =>
          document.querySelector('[data-menu-id="/create"]') as HTMLElement,
        placement: "right",
      },
      {
        title: "生成大纲",
        description:
          "AI 会自动生成世界观、角色设定和章节大纲。三步流水线逐步生成，实时预览。",
        target: () =>
          document.querySelector('[data-menu-id="/outline"]') as HTMLElement,
        placement: "right",
      },
      {
        title: "逐章创作",
        description:
          "AI 带着三层记忆（角色状态、情节事件、情感弧线）流式生成每一章，保证剧情连贯。",
        target: () =>
          document.querySelector('[data-menu-id="/chapters"]') as HTMLElement,
        placement: "right",
      },
      {
        title: "小说配图",
        description:
          "基于小说内容自动生成封面、角色立绘和场景插图。使用魔搭 ModelScope 免费图片生成 API。",
        target: () =>
          document.querySelector('[data-menu-id="/illustrations"]') as HTMLElement,
        placement: "right",
      },
      {
        title: "配置模型（重要）",
        description:
          "文本生成：填写 DeepSeek / OpenAI 等 API Key（platform.deepseek.com 获取）。图片生成：在下方「图片生成配置」区域填写魔搭 ModelScope API Token（modelscope.cn 免费获取）。",
        target: () =>
          document.querySelector('[data-menu-id="/settings"]') as HTMLElement,
        placement: "right",
      },
      {
        title: "准备就绪！",
        description:
          "完整流程：选目录 → 配模型 → 创建小说 → 生成大纲 → 写章节。有问题随时在设置页重新查看引导。祝创作愉快！",
      },
    ],
    [],
  );

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
                <FolderOpen size={13} style={{ marginRight: 6 }} />
                {dir}
              </>
            ) : (
              "未选择目录"
            )}
          </span>
          <Button
            id="tour-select-dir"
            size="small"
            onClick={selectDir}
            icon={<FolderOpen size={14} />}
          >
            选择目录
          </Button>
        </Header>
        <Content
          style={{
            margin: fullWidth ? 16 : 16,
            padding: fullWidth ? "20px 24px" : "24px 32px",
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
      <Tour
        open={tourOpen}
        onClose={handleClose}
        onFinish={handleClose}
        steps={steps}
        indicatorsRender={(current, total) => (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            {current + 1} / {total}
          </span>
        )}
      />
    </AntLayout>
  );
}
