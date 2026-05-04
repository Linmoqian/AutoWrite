import type { ExportData } from "../types";

export function renderPrintView(data: ExportData): void {
  const container = document.createElement("div");
  container.id = "print-container";

  const totalWords = data.chapters.reduce((sum, c) => sum + c.words, 0);

  let html = `
    <style>
      #print-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background: white;
        color: black;
        font-family: "SimSun", "宋体", serif;
        font-size: 14px;
        line-height: 2;
        padding: 40px 60px;
        z-index: 99999;
      }
      #print-container h1 {
        font-size: 28px;
        text-align: center;
        margin: 40px 0 10px;
        page-break-before: always;
      }
      #print-container h1:first-of-type {
        page-break-before: auto;
      }
      #print-container h2 {
        font-size: 20px;
        margin: 30px 0 10px;
      }
      #print-container h3 {
        font-size: 16px;
        margin: 20px 0 8px;
      }
      #print-container p {
        text-indent: 2em;
        margin: 0 0 0.5em;
      }
      #print-container .title-page {
        text-align: center;
        padding-top: 200px;
        page-break-after: always;
      }
      #print-container .title-page h1 {
        font-size: 36px;
        page-break-before: auto;
        margin-bottom: 30px;
      }
      #print-container .title-page .meta {
        color: #666;
        font-size: 14px;
        line-height: 2;
      }
      #print-container .toc {
        page-break-after: always;
      }
      #print-container .toc li {
        list-style: none;
        padding: 4px 0;
      }
      #print-container .toc .volume {
        font-weight: bold;
        margin-top: 16px;
      }
    </style>
  `;

  // 标题页
  html += `
    <div class="title-page">
      <h1>${escHtml(data.novel.title)}</h1>
      <div class="meta">
        <p>${escHtml(data.novel.genre)} | ${escHtml(data.novel.theme)}</p>
        <p>${data.chapters.length} 章 | ${totalWords.toLocaleString()} 字</p>
        <p>创建日期：${escHtml(data.novel.created)}</p>
      </div>
    </div>
  `;

  // 目录
  if (data.outline.length > 0) {
    html += `<div class="toc"><h1>目录</h1><ul>`;
    for (const volume of data.outline) {
      html += `<li class="volume">${escHtml(volume.volume)}</li>`;
      for (const ch of volume.chapters) {
        html += `<li>${String(ch.num).padStart(3, "0")}. ${escHtml(ch.title)}</li>`;
      }
    }
    html += `</ul></div>`;
  }

  // 世界观
  if (data.novel.world) {
    html += `<h1>世界观</h1>`;
    html += renderMdBody(data.novel.world);
  }

  // 角色
  if (data.novel.characters) {
    html += `<h1>角色</h1>`;
    html += renderMdBody(data.novel.characters);
  }

  // 章节
  for (const chapter of data.chapters) {
    html += `<h1>第${chapter.num}章 ${escHtml(chapter.title)}</h1>`;
    html += renderMdBody(chapter.body);
  }

  container.innerHTML = html;
  document.body.appendChild(container);

  // 延迟打印，确保渲染完成
  setTimeout(() => {
    window.print();
    document.body.removeChild(container);
  }, 300);
}

function renderMdBody(body: string): string {
  const lines = body.split("\n");
  let html = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "---" || trimmed === "***" || trimmed === "___") {
      continue;
    }
    const text = stripInlineMd(trimmed);
    if (text.startsWith("### ")) {
      html += `<h3>${escHtml(text.slice(4))}</h3>`;
    } else if (text.startsWith("## ")) {
      html += `<h2>${escHtml(text.slice(3))}</h2>`;
    } else if (text.startsWith("# ")) {
      html += `<h1>${escHtml(text.slice(2))}</h1>`;
    } else if (text.startsWith("· ")) {
      html += `<p style="text-indent:0">${escHtml(text)}</p>`;
    } else if (text.startsWith("  ")) {
      html += `<p style="color:#666;text-indent:0">${escHtml(text.trim())}</p>`;
    } else {
      html += `<p>${escHtml(text)}</p>`;
    }
  }
  return html;
}

function stripInlineMd(text: string): string {
  // 先处理块级前缀
  let result = text;
  // - item / * item → · item
  if (/^[-*]\s/.test(result)) {
    result = "· " + result.slice(2);
  }
  // > quote → 缩进
  if (result.startsWith("> ")) {
    result = "  " + result.slice(2);
  }
  // 去除行内格式符号
  result = result
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold** → bold
    .replace(/\*(.+?)\*/g, "$1")        // *italic* → italic
    .replace(/`(.+?)`/g, "$1")          // `code` → code
    .replace(/~~(.+?)~~/g, "$1")        // ~~strike~~ → strike
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");// [link](url) → link
  return result;
}

function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
