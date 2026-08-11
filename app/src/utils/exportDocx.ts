import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} from "docx";
import type { ExportData } from "../types";

const FONT_CN = "SimSun";

export async function generateDocx(data: ExportData): Promise<Uint8Array> {
  const children: Paragraph[] = [];

  // 标题页
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: data.novel.title,
          size: 56,
          bold: true,
          font: FONT_CN,
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${data.novel.genre} | ${data.novel.theme}`,
          size: 24,
          font: FONT_CN,
          color: "666666",
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `创建日期：${data.novel.created}`,
          size: 22,
          font: FONT_CN,
          color: "999999",
        }),
      ],
    }),
  );

  // 世界观
  if (data.novel.world) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "世界观", font: FONT_CN })],
      }),
    );
    pushBodyParagraphs(children, data.novel.world);
  }

  // 角色
  if (data.novel.characters) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "角色", font: FONT_CN })],
      }),
    );
    pushBodyParagraphs(children, data.novel.characters);
  }

  // 目录
  if (data.outline.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "目录", font: FONT_CN })],
      }),
    );
    for (const volume of data.outline) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: volume.volume, font: FONT_CN })],
        }),
      );
      for (const ch of volume.chapters) {
        children.push(
          new Paragraph({
            indent: { left: 360 },
            children: [
              new TextRun({
                text: `${String(ch.num).padStart(3, "0")}. ${ch.title}`,
                font: FONT_CN,
                size: 21,
              }),
            ],
          }),
        );
      }
    }
  }

  // 章节
  for (const chapter of data.chapters) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: `第${chapter.num}章 ${chapter.title}`,
            font: FONT_CN,
          }),
        ],
      }),
    );
    pushBodyParagraphs(children, chapter.body);
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: FONT_CN, size: 24 },
        },
        heading1: {
          run: { font: FONT_CN, size: 36, bold: true },
        },
        heading2: {
          run: { font: FONT_CN, size: 30, bold: true },
        },
      },
    },
  });

  return Packer.toBuffer(doc) as Promise<Uint8Array>;
}

function pushBodyParagraphs(children: Paragraph[], body: string): void {
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      children.push(new Paragraph({ spacing: { before: 200, after: 200 } }));
      continue;
    }
    if (trimmed.startsWith("### ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: trimmed.slice(4), font: FONT_CN })],
        }),
      );
    } else if (trimmed.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: trimmed.slice(3), font: FONT_CN })],
        }),
      );
    } else if (trimmed.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: trimmed.slice(2), font: FONT_CN })],
        }),
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      children.push(
        new Paragraph({
          spacing: { line: 360 },
          indent: { left: 480 },
          children: [
            new TextRun({ text: `· ${trimmed.slice(2)}`, font: FONT_CN, size: 24 }),
          ],
        }),
      );
    } else if (trimmed.startsWith("> ")) {
      children.push(
        new Paragraph({
          spacing: { line: 360 },
          indent: { left: 480 },
          children: [
            new TextRun({
              text: trimmed.slice(2),
              font: FONT_CN,
              size: 24,
              italics: true,
              color: "666666",
            }),
          ],
        }),
      );
    } else {
      const runs = parseInlineRuns(trimmed);
      children.push(
        new Paragraph({
          spacing: { line: 360 },
          indent: { firstLine: 480 },
          children: runs,
        }),
      );
    }
  }
}

interface RunSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

function parseInlineRuns(text: string): TextRun[] {
  const segments: RunSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // **bold**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // *italic*
    const italicMatch = remaining.match(/\*(.+?)\*/);
    // `code`
    const codeMatch = remaining.match(/`(.+?)`/);
    // ~~strike~~
    const strikeMatch = remaining.match(/~~(.+?)~~/);
    // [link](url)
    const linkMatch = remaining.match(/\[(.+?)\]\(.+?\)/);

    type MdMatch = { index: number; len: number; text: string; bold: boolean; italic: boolean };
    const candidates: MdMatch[] = [];

    if (boldMatch && boldMatch.index !== undefined) {
      candidates.push({ index: boldMatch.index, len: boldMatch[0].length, text: boldMatch[1], bold: true, italic: false });
    }
    if (italicMatch && italicMatch.index !== undefined) {
      candidates.push({ index: italicMatch.index, len: italicMatch[0].length, text: italicMatch[1], bold: false, italic: true });
    }
    if (codeMatch && codeMatch.index !== undefined) {
      candidates.push({ index: codeMatch.index, len: codeMatch[0].length, text: codeMatch[1], bold: false, italic: false });
    }
    if (strikeMatch && strikeMatch.index !== undefined) {
      candidates.push({ index: strikeMatch.index, len: strikeMatch[0].length, text: strikeMatch[1], bold: false, italic: false });
    }
    if (linkMatch && linkMatch.index !== undefined) {
      candidates.push({ index: linkMatch.index, len: linkMatch[0].length, text: linkMatch[1], bold: false, italic: true });
    }

    if (candidates.length === 0) {
      segments.push({ text: remaining, bold: false, italic: false });
      break;
    }

    const first = candidates.reduce((a, b) => (a.index < b.index ? a : b));

    if (first.index > 0) {
      segments.push({ text: remaining.slice(0, first.index), bold: false, italic: false });
    }
    segments.push({ text: first.text, bold: first.bold, italic: first.italic });
    remaining = remaining.slice(first.index + first.len);
  }

  return segments.map(
    (s) => new TextRun({ text: s.text, font: FONT_CN, size: 24, bold: s.bold, italics: s.italic }),
  );
}
