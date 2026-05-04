import { useState, useEffect } from "react";
import { Card, Button, message, Spin, Empty, Descriptions, Tag } from "antd";
import {
  FileTextOutlined,
  FileOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { ExportData, ExportFormat } from "../types";
import { getExportData, exportNovel, saveExportFile } from "../services/tauri";
import { generateDocx } from "../utils/exportDocx";
import { renderPrintView } from "../utils/exportPdf";

const FORMATS: {
  key: ExportFormat;
  label: string;
  icon: React.ReactNode;
  desc: string;
  color: string;
}[] = [
  {
    key: "md",
    label: "Markdown",
    icon: <FileTextOutlined style={{ fontSize: 28 }} />,
    desc: "保留完整 Markdown 格式",
    color: "#d4a574",
  },
  {
    key: "txt",
    label: "纯文本",
    icon: <FileOutlined style={{ fontSize: 28 }} />,
    desc: "纯文本格式，兼容性最好",
    color: "#8bc34a",
  },
  {
    key: "docx",
    label: "Word 文档",
    icon: <FileWordOutlined style={{ fontSize: 28 }} />,
    desc: "Word 文档格式，方便编辑",
    color: "#42a5f5",
  },
  {
    key: "pdf",
    label: "PDF",
    icon: <FilePdfOutlined style={{ fontSize: 28 }} />,
    desc: "打印为 PDF，阅读体验佳",
    color: "#ef5350",
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
        message.success(`导出成功：${path}`);
      } else if (selectedFormat === "docx") {
        const bytes = await generateDocx(data);
        const filename = `${data.novel.title}.docx`;
        const path = await saveExportFile(Array.from(bytes), filename, "docx");
        message.success(`导出成功：${path}`);
      } else if (selectedFormat === "pdf") {
        renderPrintView(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "用户取消导出") {
        message.error(`导出失败：${msg}`);
      }
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fade-in">
        <h2 className="page-title">导出小说</h2>
        <Empty
          description="请先选择小说目录并创建小说"
          style={{ marginTop: 60 }}
        />
      </div>
    );
  }

  const totalWords = data.chapters.reduce((sum, c) => sum + c.words, 0);

  return (
    <div className="fade-in">
      <h2 className="page-title">导出小说</h2>

      <Card
        size="small"
        style={{ marginBottom: 20 }}
        styles={{ body: { padding: "16px 20px" } }}
      >
        <Descriptions column={3} size="small" colon={false}>
          <Descriptions.Item label="小说名称">
            <span style={{ color: "var(--gold)", fontWeight: 600 }}>
              {data.novel.title}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag>{data.novel.genre}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="主题">
            <Tag>{data.novel.theme}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="已写章节">
            {data.chapters.length} / {data.novel.target_chapters} 章
          </Descriptions.Item>
          <Descriptions.Item label="总字数">
            {totalWords.toLocaleString()} 字
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {FORMATS.map((fmt) => {
          const selected = selectedFormat === fmt.key;
          return (
            <Card
              key={fmt.key}
              hoverable
              size="small"
              style={{
                cursor: "pointer",
                border: selected
                  ? `2px solid ${fmt.color}`
                  : "2px solid var(--border)",
                background: selected
                  ? `rgba(${hexToRgb(fmt.color)}, 0.08)`
                  : "var(--bg-primary)",
                transition: "all 0.2s",
              }}
              styles={{ body: { padding: "16px 20px" } }}
              onClick={() => setSelectedFormat(fmt.key)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    color: selected ? fmt.color : "var(--text-secondary)",
                    transition: "color 0.2s",
                  }}
                >
                  {fmt.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: selected ? fmt.color : "var(--text-primary)",
                    }}
                  >
                    {fmt.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {fmt.desc}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ textAlign: "center" }}>
        <Button
          type="primary"
          size="large"
          icon={<DownloadOutlined />}
          loading={exporting}
          disabled={!selectedFormat || data.chapters.length === 0}
          onClick={handleExport}
          style={{ minWidth: 200 }}
        >
          {selectedFormat ? `导出为 ${FORMATS.find((f) => f.key === selectedFormat)?.label}` : "请选择导出格式"}
        </Button>
        {data.chapters.length === 0 && (
          <div style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 13 }}>
            暂无章节可导出，请先生成章节
          </div>
        )}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
