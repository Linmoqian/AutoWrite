import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getExportData, exportNovel, saveExportFile } from "@/services/tauri";
import { generateDocx } from "@/utils/exportDocx";
import { renderPrintView } from "@/utils/exportPdf";
import type { ExportData, ExportFormat } from "@/types";

async function runExport(format: ExportFormat, data: ExportData): Promise<void> {
  if (format === "md" || format === "txt") {
    const path = await exportNovel(format);
    toast.success(`导出成功：${path}`);
    return;
  }
  if (format === "docx") {
    const bytes = await generateDocx(data);
    const filename = `${data.novel.title}.docx`;
    const path = await saveExportFile(Array.from(bytes), filename, "docx");
    toast.success(`导出成功：${path}`);
    return;
  }
  renderPrintView(data);
}

/** 导出页数据加载 + 导出动作 */
export function useExport() {
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
      await runExport(selectedFormat, data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "用户取消导出") {
        toast.error(`导出失败：${msg}`);
      }
    } finally {
      setExporting(false);
    }
  };

  return {
    data,
    loading,
    selectedFormat,
    setSelectedFormat,
    exporting,
    handleExport,
  };
}
