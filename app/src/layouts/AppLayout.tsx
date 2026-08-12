import { type ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Book,
  Plus,
  ListOrdered,
  BookOpen,
  Settings,
  FolderOpen,
  Download,
  Image as ImageIcon,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TOUR_KEY } from "@/lib/constants";
import { CopilotPanel } from "@/features/chat";

interface NavItem {
  key: string;
  icon: ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "/", icon: <Book className="h-4 w-4" />, label: "仪表盘" },
  { key: "/create", icon: <Plus className="h-4 w-4" />, label: "创建小说" },
  { key: "/outline", icon: <ListOrdered className="h-4 w-4" />, label: "大纲管理" },
  { key: "/chapters", icon: <BookOpen className="h-4 w-4" />, label: "章节管理" },
  { key: "/illustrations", icon: <ImageIcon className="h-4 w-4" />, label: "小说配图" },
  { key: "/export", icon: <Download className="h-4 w-4" />, label: "导出小说" },
  { key: "/settings", icon: <Settings className="h-4 w-4" />, label: "模型配置" },
];

const FULL_WIDTH_ROUTES = ["/chapters"];

interface TourStep {
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "欢迎来到小说大批发",
    description: "全自动 AI 小说创作工具。接下来用 30 秒了解核心流程。",
  },
  {
    title: "选择小说目录",
    description: "先选一个本地文件夹，所有数据（大纲、章节、配图）保存在这里。",
  },
  {
    title: "创建小说",
    description: "设定标题、类型、主题和目标章节数，AI 根据设定创作。",
  },
  {
    title: "生成大纲",
    description: "AI 自动生成世界观、角色设定和章节大纲，三步流水线实时预览。",
  },
  {
    title: "逐章创作",
    description: "AI 带着三层记忆流式生成每一章，保证剧情连贯。",
  },
  {
    title: "小说配图",
    description: "基于小说内容自动生成封面、角色立绘和场景插图。",
  },
  {
    title: "配置模型",
    description: "文本生成填 DeepSeek / OpenAI API Key，图片生成填 ModelScope Token。",
  },
  {
    title: "准备就绪",
    description: "流程：选目录 → 配模型 → 创建小说 → 生成大纲 → 写章节。",
  },
];

function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];
  const isLast = step === total - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] max-w-[90vw] rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide text-muted-foreground">
              {step + 1} / {total}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mb-2 font-serif text-xl font-medium text-foreground">
          {current.title}
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {current.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                上一步
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (isLast ? onClose() : setStep(step + 1))}
            >
              {isLast ? "开始使用" : "下一步"}
              {!isLast && <ChevronRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const novelDir = useAppStore((s) => s.novelDir);
  const selectDir = useAppStore((s) => s.selectDir);
  const refreshNovelDir = useAppStore((s) => s.refreshNovelDir);
  const refreshStatus = useAppStore((s) => s.refreshStatus);
  const toggleChat = useChatStore((s) => s.toggle);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    refreshNovelDir();
    refreshStatus();
    if (!localStorage.getItem(TOUR_KEY)) {
      setTourOpen(true);
    }
  }, [refreshNovelDir, refreshStatus]);

  const handleCloseTour = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setTourOpen(false);
  };

  const fullWidth = FULL_WIDTH_ROUTES.includes(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — 220px */}
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-card">
        <div className="px-5 pb-2 pt-5 text-center">
          <div className="font-serif text-xl tracking-[0.2em] text-primary">
            小说大批发
          </div>
          <div className="mt-1 text-[11px] tracking-wider text-muted-foreground">
            全自动小说创作
          </div>
        </div>
        <div className="mx-5 my-3 h-px bg-border" />
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header — 48px */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-7">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            {novelDir ?? "未选择目录"}
          </span>
          <Button id="tour-select-dir" variant="secondary" size="sm" onClick={selectDir}>
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            选择目录
          </Button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <div
            className={cn(
              "h-full overflow-y-auto rounded-lg border border-border bg-card",
              fullWidth ? "p-5" : "p-6"
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {/* 副驾驶浮动入口 + 面板（全局，任何页面可用） */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="打开副驾驶助手"
      >
        <Sparkles className="h-5 w-5" />
      </button>
      <CopilotPanel />

      {tourOpen && <OnboardingTour onClose={handleCloseTour} />}
    </div>
  );
}
