import { useState, useEffect } from "react";
import {
  FileText,
  File,
  FileType2,
  FileType,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getExportData, exportNovel, saveExportFile } from "@/services/tauri";
import { generateDocx } from "@/utils/exportDocx";
import { renderPrintView } from "@/utils/exportPdf";
import type { ExportData, ExportFormat } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FORMATS: {
  key: ExportFormat;
  label: string;
  icon: React.ReactNode;
  desc: string;
}[] = [
  {
    key: "md",
    label: "Markdown",
    icon: <FileText className="h-7 w-7" />,
    desc: "保留完整 Markdown 格式",
  },
  {
    key: "txt",
    label: "纯文本",
    icon: <File className="h-7 w-7" />,
    desc: "纯文本格式，兼容性最好",
  },
  {
    key: "docx",
    label: "Word 文档",
    icon: <FileType2 className="h-7 w-7" />,
    desc: "Word 文档格式，方便编辑",
  },
  {
    key: "pdf",
    label: "PDF",
    icon: <FileType className="h-7 w-7" />,
    desc: "打印为 PDF，阅读体验佳",
  },
];

export default function ExportPage() {
  const [data, setData] = useState<ExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getExportData()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    if (!selectedFormat || !data) return;
    setExporting(true);
    try {
      if (selectedFormat === "md" || selectedFormat === "txt") {
        const path = await exportNovel(selectedFormat);
        toast.success(`导出成功：${path}`);
      } else if (selectedFormat === "docx") {
        const bytes = await generateDocx(data);
        const filename = `${data.novel.title}.docx`;
        const path = await saveExportFile(Array.from(bytes), filename, "docx");
        toast.success(`导出成功：${path}`);
      } else if (selectedFormat === "pdf") {
        renderPrintView(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "用户取消导出") {
        toast.error(`导出失败：${msg}`);
      }
    } finally {
      setExporting(false);
    }
  };

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

  const totalWords = data.chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const selectedFmt = FORMATS.find((f) => f.key === selectedFormat);

  return (
    <div className="fade-in mx-auto max-w-[720px]">
      <h2 className="page-title">导出小说</h2>

      {/* Novel info */}
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
            <span className="font-mono tabular-nums">{totalWords.toLocaleString()} 字</span>
          </div>
        </CardContent>
      </Card>

      {/* Format selection */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FORMATS.map((fmt) => {
          const selected = selectedFormat === fmt.key;
          return (
            <button
              key={fmt.key}
              onClick={() => setSelectedFormat(fmt.key)}
              className={cn(
                "flex items-center gap-3.5 rounded-lg border-2 p-4 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              <div
                className={cn(
                  "transition-colors",
                  selected ? "text-primary" : "text-muted-foreground"
                )}
              >
                {fmt.icon}
              </div>
              <div>
                <div
                  className={cn(
                    "font-medium",
                    selected ? "text-primary" : "text-foreground"
                  )}
                >
                  {fmt.label}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {fmt.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

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
          {selectedFormat ? `导出为 ${selectedFmt?.label}` : "请选择导出格式"}
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
