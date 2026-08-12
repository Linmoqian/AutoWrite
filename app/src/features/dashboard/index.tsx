import { useNavigate } from "react-router-dom";
import { Book, FileText, PenLine, ListOrdered } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "./components/collapsible-section";
import { BatchImagePanel } from "./components/batch-image-panel";

export default function Dashboard() {
  const navigate = useNavigate();
  const status = useAppStore((s) => s.novelStatus);

  if (!status) {
    return (
      <div className="fade-in flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">请先选择小说目录并创建小说</p>
          <Button onClick={() => navigate("/create")}>
            <PenLine className="mr-1.5 h-4 w-4" />
            创建小说
          </Button>
        </div>
      </div>
    );
  }

  const { novel, context, totalChapters, writtenChapters } = status;
  const progressPercent =
    totalChapters > 0 ? Math.round((writtenChapters / totalChapters) * 100) : 0;

  const stats = [
    { label: "类型", value: novel.genre, icon: <Book className="h-4 w-4" /> },
    { label: "主题", value: novel.theme, icon: null },
    { label: "目标章节", value: `${novel.targetChapters} 章`, icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <div className="fade-in mx-auto max-w-[720px]">
      <h1 className="page-title">{novel.title}</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {s.icon}
                {s.label}
              </div>
              <div className="text-lg font-medium text-foreground">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="mb-2 text-xs text-muted-foreground">创作进度</div>
          <Progress value={progressPercent} className="h-2" />
          <div className="mt-2 text-right text-xs text-muted-foreground">
            {writtenChapters} / {totalChapters} 章（{progressPercent}%）
          </div>
        </CardContent>
      </Card>

      {/* Recent plot events */}
      {context.plotEvents.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">最近剧情事件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {context.plotEvents.slice(-5).map((e, i) => (
              <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="shrink-0">
                  第{e.chapter}章
                </Badge>
                <span>{e.event}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* World view */}
      {novel.worldView && (
        <CollapsibleSection title="世界观" content={novel.worldView} />
      )}

      {/* Characters */}
      {novel.characters && (
        <CollapsibleSection title="角色" content={novel.characters} />
      )}

      {/* 批量生成场景插图（真并发演示） */}
      <BatchImagePanel />

      {/* Navigation */}
      <div className="mt-5 flex gap-3">
        <Button variant="outline" onClick={() => navigate("/outline")}>
          <ListOrdered className="mr-1.5 h-4 w-4" />
          查看大纲
        </Button>
        <Button variant="outline" onClick={() => navigate("/chapters")}>
          <Book className="mr-1.5 h-4 w-4" />
          查看章节
        </Button>
      </div>
    </div>
  );
}
