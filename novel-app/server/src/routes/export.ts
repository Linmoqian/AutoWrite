// 导出路由：get_export_data / export_novel（仅 md/txt，返回内容字符串）。
// 注意：Rust 的 export_novel 会弹保存对话框写文件；Node 侧改为返回内容，前端用 Blob 下载。
// DOCX/PDF 由前端生成，不走这里。

import type { FastifyInstance } from "fastify";

import { AppError } from "../error.js";
import { collectExportData, renderMarkdown, renderPlainText } from "../export.js";
import { dirFromState } from "../lib/state-helpers.js";

export function registerExportRoutes(app: FastifyInstance): void {
  // get_export_data
  app.get("/api/get_export_data", () => collectExportData(dirFromState()));

  // export_novel?format=md|txt → 返回 { content, defaultName }
  app.post("/api/export_novel", async (req) => {
    const { format } = (req.body ?? {}) as { format: string };
    const dir = dirFromState();
    const data = collectExportData(dir);
    let content: string;
    if (format === "md") {
      content = renderMarkdown(data);
    } else if (format === "txt") {
      content = renderPlainText(data);
    } else {
      throw AppError.export(`不支持的格式: ${format}`);
    }
    const defaultName = `${data.novel.title}.${format}`;
    return { content, defaultName };
  });
}
