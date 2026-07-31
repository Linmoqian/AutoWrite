// context.md 读写，照搬 src-tauri/src/files.rs:316-454。
// ⚠️ 这是 files 模块最复杂的部分，存在刻意的非对称性，必须严格复刻：
//
// 写入（files.rs:316-367）：
//   - 标题 # 上下文摘要 / ## 各 section
//   - plot_events 用 iter().rev().take(10)：反序取前 10
//   - tension_checklist 用 iter().rev().take(10)：反序取前 10；resolved -> [x]，否则 [ ]
//   - emotional_arc 用 iter().rev().take(8)：反序取前 8
//   - 不写 recent_summaries / pending_plots / unresolved_threads（这几个字段从磁盘读回永远为空）
//   - character_states 写成单行字符串："name：location，power_level，recent_action"
//
// 读取（files.rs:369-454）：
//   - section 头用中文匹配（## 当前进度 / ## 剧情摘要 / ## 角色状态 / ## 待埋伏笔 /
//     ## 叙事意图 / ## 关键事件 / ## 未解决悬念 / ## 张力清单 / ## 情感弧线）
//   - plot_events / tension_checklist / emotional_arc：读回顺序 = 写入顺序的反转
//     （因为写入是反序，读回是正序追加）
//   - character_states 读成字符串（不是对象）
//   - tension 行格式 "- [x] item" 或 "- [ ] item"，item 取 s[6..]
//   - emotion 行 "- tag(intensity)"，按最后一个 '(' 分割

import { contextFile, readFile, writeFileAtomic } from "./atomic.js";
import type {
  CharacterStateRaw,
  ContextData,
  TensionItem,
} from "./types.js";
import { defaultContextData } from "./types.js";

export function writeContext(dir: string, ctx: ContextData): void {
  const lines: string[] = [
    `# 上下文摘要\n\n## 当前进度\n- 已完成：${ctx.current_chapter}章\n`,
  ];

  // 叙事意图
  if (ctx.current_intent) {
    const intent = ctx.current_intent;
    lines.push("## 叙事意图");
    lines.push(`- 角色想要：${intent.character_wants}`);
    lines.push(`- 阻碍：${intent.obstacle}`);
    lines.push(`- 读者关注：${intent.reader_should_care}`);
    lines.push("");
  }

  // 角色状态（对象才写出，字符串跳过 name 字段提取）
  if (ctx.character_states.length > 0) {
    lines.push("## 角色状态");
    for (const s of ctx.character_states) {
      const name = stateField(s, "name");
      if (name) {
        const location = stateField(s, "location") ?? "?";
        const power = stateField(s, "power_level") ?? "?";
        const action = stateField(s, "recent_action") ?? "?";
        lines.push(`- ${name}：${location}，${power}，${action}`);
      }
    }
    lines.push("");
  }

  // 关键事件：反序取前 10
  if (ctx.plot_events.length > 0) {
    lines.push("## 关键事件");
    for (const e of reverseTake(ctx.plot_events, 10)) {
      lines.push(`- ${e}`);
    }
    lines.push("");
  }

  // 张力清单：反序取前 10；resolved -> x 否则空格
  if (ctx.tension_checklist.length > 0) {
    lines.push("## 张力清单");
    for (const t of reverseTake(ctx.tension_checklist, 10)) {
      const mark = t.status === "resolved" ? "x" : " ";
      lines.push(`- [${mark}] ${t.item}`);
    }
    lines.push("");
  }

  // 情感弧线：反序取前 8
  if (ctx.emotional_arc.length > 0) {
    lines.push("## 情感弧线");
    for (const e of reverseTake(ctx.emotional_arc, 8)) {
      lines.push(`- ${e.tag}(${e.intensity})`);
    }
    lines.push("");
  }

  writeFileAtomic(contextFile(dir), lines.join("\n"));
}

// 从 CharacterStateRaw 提取字符串字段（对象时取 key，字符串时返回 undefined）
function stateField(s: CharacterStateRaw, key: string): string | undefined {
  if (typeof s === "string") return undefined;
  const v = s[key];
  return typeof v === "string" ? v : undefined;
}

// 模拟 Rust 的 iter().rev().take(n)：返回最后 n 个元素的反序
function reverseTake<T>(arr: T[], n: number): T[] {
  const start = Math.max(0, arr.length - n);
  return arr.slice(start).reverse();
}

// 读 context.md，照搬 files.rs:369-454
export function readContext(dir: string): ContextData {
  const content = readFile(contextFile(dir));
  const result = defaultContextData();
  if (content === "") return result;

  let section: string | null = null;
  for (const rawLine of content.split("\n")) {
    const s = rawLine.trim();
    if (s.startsWith("## 当前进度")) section = "progress";
    else if (s.startsWith("## 剧情摘要")) section = "summaries";
    else if (s.startsWith("## 角色状态")) section = "characters";
    else if (s.startsWith("## 待埋伏笔")) section = "plots";
    else if (s.startsWith("## 叙事意图")) section = "intent";
    else if (s.startsWith("## 关键事件")) section = "events";
    else if (s.startsWith("## 未解决悬念")) section = "threads";
    else if (s.startsWith("## 张力清单")) section = "tension";
    else if (s.startsWith("## 情感弧线")) section = "emotion";
    else if (s !== "") {
      if (section === "progress" && s.includes("已完成：")) {
        const idx = s.indexOf("已完成：");
        const numStr = s.slice(idx + "已完成：".length).replace("章", "");
        const n = parseInt(numStr.trim(), 10);
        if (!Number.isNaN(n)) result.current_chapter = n;
      } else if (section === "summaries" && !s.startsWith("#")) {
        result.recent_summaries.push(s);
      } else if (section === "characters" && s.startsWith("- ")) {
        result.character_states.push(s.slice(2));
      } else if (section === "plots" && s.startsWith("- ")) {
        result.pending_plots.push(s.slice(2));
      } else if (section === "intent" && s.startsWith("- ")) {
        const text = s.slice(2);
        if (!result.current_intent) {
          result.current_intent = {
            character_wants: "",
            obstacle: "",
            reader_should_care: "",
          };
        }
        const intent = result.current_intent;
        if (text.startsWith("角色想要：")) {
          intent.character_wants = text.slice("角色想要：".length);
        } else if (text.startsWith("阻碍：")) {
          intent.obstacle = text.slice("阻碍：".length);
        } else if (text.startsWith("读者关注：")) {
          intent.reader_should_care = text.slice("读者关注：".length);
        }
      } else if (section === "events" && s.startsWith("- ")) {
        result.plot_events.push(s.slice(2));
      } else if (section === "threads" && s.startsWith("- [ ] ")) {
        result.unresolved_threads.push(s.slice(6));
      } else if (section === "tension" && s.startsWith("- [")) {
        // s.chars().nth(3)：第 4 个字符（"-"、" "、"["、mark）
        const chars = [...s];
        const mark = chars[3] ?? " ";
        const item = s.slice(6);
        const tensionItem: TensionItem = {
          item,
          status: mark === "x" ? "resolved" : "open",
        };
        result.tension_checklist.push(tensionItem);
      } else if (section === "emotion" && s.startsWith("- ")) {
        const text = s.slice(2);
        const pos = text.lastIndexOf("(");
        if (pos >= 0) {
          const tag = text.slice(0, pos);
          const intensityStr = text.slice(pos + 1).replace(/\)+$/, "");
          const intensity = parseInt(intensityStr, 10);
          if (!Number.isNaN(intensity)) {
            result.emotional_arc.push({ tag, intensity });
          }
        }
      }
    }
  }
  return result;
}
