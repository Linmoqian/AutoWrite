import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { NovelStatus } from "@/types";

export function ExistingNovelCard({
  status,
  onClick,
}: {
  status: NovelStatus;
  onClick: () => void;
}) {
  const { novel, writtenChapters, totalChapters } = status;
  const progressPercent =
    totalChapters > 0 ? Math.round((writtenChapters / totalChapters) * 100) : 0;

  return (
    <Card
      className="mb-4 cursor-pointer transition-colors hover:border-primary/30"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{novel.title}</span>
            <Badge variant="secondary">{novel.genre}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">{novel.theme}</span>
        </div>
        <div className="mt-3">
          <Progress value={progressPercent} className="h-1.5" />
          <div className="mt-1 text-right text-xs text-muted-foreground">
            {writtenChapters} / {totalChapters} 章
          </div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">点击查看详情</div>
      </CardContent>
    </Card>
  );
}
