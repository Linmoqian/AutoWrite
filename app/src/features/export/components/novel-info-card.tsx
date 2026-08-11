import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ExportData } from "@/types";

export function NovelInfoCard({ data }: { data: ExportData }) {
  const totalWords = data.chapters.reduce((sum, c) => sum + c.wordCount, 0);

  return (
    <Card className="mb-5">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">小说名称：</span>
          <span className="font-medium text-primary">{data.novel.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">类型：</span>
          <Badge variant="secondary">{data.novel.genre}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">主题：</span>
          <Badge variant="secondary">{data.novel.theme}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">已写章节：</span>
          <span>{data.chapters.length} / {data.novel.targetChapters} 章</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">总字数：</span>
          <span className="font-mono tabular-nums">
            {totalWords.toLocaleString()} 字
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
