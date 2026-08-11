import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChapterCard } from "@/components/common/ChapterCard";
import { useChapters } from "./hooks/use-chapters";
import { ReadingView } from "./components/reading-view";

export default function Chapters() {
  const {
    chapters,
    selected,
    isGenerating,
    generatingMeta,
    displayText,
    viewingDuringGen,
    loadingChapter,
    handleSelect,
    handleGenerate,
    handleViewGenerating,
    streamRef,
  } = useChapters();

  if (chapters.length === 0 && !isGenerating) {
    return (
      <div className="fade-in">
        <h1 className="page-title">章节管理</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <p className="text-muted-foreground">
              暂无章节，请先在「大纲管理」页面生成大纲
            </p>
            <Button onClick={handleGenerate}>
              <FileText className="mr-1.5 h-4 w-4" />
              写第一章
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in flex h-full flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h1 className="page-title mb-0 pb-0">章节管理</h1>
        <Button onClick={handleGenerate} loading={isGenerating}>
          <FileText className="mr-1.5 h-4 w-4" />
          写下一章
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Chapter list */}
        <Card className="w-[220px] shrink-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-0.5 p-2">
              {chapters.map((ch) => (
                <ChapterCard
                  key={ch.filename}
                  chapter={ch}
                  selected={!isGenerating && selected?.meta.number === ch.number}
                  onClick={() => handleSelect(ch.filename, ch.number)}
                />
              ))}
              {generatingMeta && (
                <ChapterCard
                  chapter={generatingMeta}
                  selected={!viewingDuringGen}
                  generating
                  onClick={handleViewGenerating}
                />
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Reading / streaming view */}
        <Card className="min-w-0 flex-1 overflow-hidden">
          <ReadingView
            isGenerating={isGenerating}
            viewingDuringGen={viewingDuringGen}
            loadingChapter={loadingChapter}
            displayText={displayText}
            streamRef={streamRef}
            selected={selected}
          />
        </Card>
      </div>
    </div>
  );
}
