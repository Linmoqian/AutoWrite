import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXPORT_FORMATS } from "./formats";
import { useExport } from "./hooks/use-export";
import { FormatPicker } from "./components/format-picker";
import { NovelInfoCard } from "./components/novel-info-card";

export default function ExportPage() {
  const {
    data,
    loading,
    selectedFormat,
    setSelectedFormat,
    exporting,
    handleExport,
  } = useExport();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fade-in">
        <h2 className="page-title">导出小说</h2>
        <div className="mt-15 flex items-center justify-center py-12 text-muted-foreground">
          请先选择小说目录并创建小说
        </div>
      </div>
    );
  }

  const selectedLabel = EXPORT_FORMATS.find((f) => f.key === selectedFormat)?.label;

  return (
    <div className="fade-in mx-auto max-w-[720px]">
      <h2 className="page-title">导出小说</h2>

      <NovelInfoCard data={data} />

      <FormatPicker selected={selectedFormat} onSelect={setSelectedFormat} />

      {/* Export button */}
      <div className="text-center">
        <Button
          size="lg"
          onClick={handleExport}
          loading={exporting}
          disabled={!selectedFormat || data.chapters.length === 0}
          className="min-w-[200px]"
        >
          <Download className="mr-1.5 h-4 w-4" />
          {selectedFormat ? `导出为 ${selectedLabel}` : "请选择导出格式"}
        </Button>
        {data.chapters.length === 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            暂无章节可导出，请先生成章节
          </div>
        )}
      </div>
    </div>
  );
}
