import { File, FileText, FileType, FileType2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ExportFormat } from "@/types";

export interface ExportFormatMeta {
  key: ExportFormat;
  label: string;
  icon: LucideIcon;
  desc: string;
}

/** 可选导出格式（顺序即界面展示顺序） */
export const EXPORT_FORMATS: ExportFormatMeta[] = [
  {
    key: "md",
    label: "Markdown",
    icon: FileText,
    desc: "保留完整 Markdown 格式",
  },
  {
    key: "txt",
    label: "纯文本",
    icon: File,
    desc: "纯文本格式，兼容性最好",
  },
  {
    key: "docx",
    label: "Word 文档",
    icon: FileType2,
    desc: "Word 文档格式，方便编辑",
  },
  {
    key: "pdf",
    label: "PDF",
    icon: FileType,
    desc: "打印为 PDF，阅读体验佳",
  },
];
