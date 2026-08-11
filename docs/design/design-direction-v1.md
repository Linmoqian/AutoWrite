# AutoWrite UI/UX 设计方向文档 v1

> 生成日期：2026-08-11 | 设计师：颜好看 | 基于：PRD v1 + 架构文档 v1
> 三轴刻度：Variance=4 / Motion=3 / Density=5
> 设计寄存器：Product（工具型应用，设计服务产品）

---

## 1. 设计语言与对标品牌

### 1.1 设计寄存器判断

**Product 寄存器**——AutoWrite 是桌面工具型应用（Tauri），设计服务产品本身。标杆是"赢得熟悉感"：让写作者觉得可信、专业、高效。不是品牌落地页，不需要视觉冲击力，需要的是长时间使用的舒适度和清晰度。

### 1.2 视觉主题关键词

**沉稳、温暖、专注、书卷、工坊**

- 沉稳：暗色为主，但不冷酷，带微妙暖色调
- 温暖：琥珀色强调如台灯暖光，营造书房氛围
- 专注：大面积留白 + 克制色彩，让内容（小说文本）成为主角
- 书卷：文学字体 + 纸张质感的暖灰背景
- 工坊：工具感清晰，操作路径明确，状态反馈即时

### 1.3 对标品牌

| 品牌 | 借鉴点 | 不借鉴 |
|------|--------|--------|
| **Linear** | 极简暗色 UI、键盘快捷键优先、状态反馈清晰 | 不用其冷蓝色调 |
| **Notion** | 内容优先的留白布局、阅读舒适度、block 式内容组织 | 不用其全白背景 |
| **Raycast** | 暗色桌面工具的精致感、命令面板交互、紧凑信息密度 | 不用其紫色 accent |
| **iA Writer** | 写作工具的纯粹性、专注模式、字体层级 | 不用其极简到无 chrome |

### 1.4 设计风格定义

**温暖暗色极简（Warm Dark Minimalism）**

基于瑞士极简主义 + 暗色模式优化，但引入暖色中性色基调（warm-neutral dark gray）替代原项目的冷紫色背景。强调色使用温暖的琥珀/蜂蜜色，呼应原项目的"墨夜书房"文学意象，但彻底消除紫色系。

### 1.5 三轴设计刻度

| 参数 | 值 | 含义 |
|------|-----|------|
| DESIGN_VARIANCE | 4 | 可预测布局，Flexbox 居中 + 标准网格，允许少量非对称偏移（如章节列表+内容区分屏） |
| MOTION_INTENSITY | 3 | 极低动效，仅 hover/active/focus 功能性动效，打字机流式效果是唯一持续动画 |
| VISUAL_DENSITY | 5 | 中等密度，标准间距，卡片容器存在但克制，适合长时间阅读 |

---

## 2. 配色方案（替换暗紫色主题）

### 2.1 设计意图

原项目使用暗紫色背景（#191930 / #21213a / #111120），**违反 P0-2 规则**。新方案核心目标：

1. **彻底替换紫色背景** → 改为暖中性深灰（warm-neutral dark charcoal）
2. **保留温暖文学感** → 琥珀色 accent 呼应原项目金棕色 #d4a574 的书房意象
3. **优化长时间阅读** → 遵循暗色模式研究结论：
   - 避免纯黑 #000000（导致 OLED smearing + 散光患者光晕效应）
   - 避免纯白文字（对比度过高导致 halation）
   - 目标对比度 13:1~15:1（高于 WCAG AA 4.5:1，低于最大 21:1）
   - 深色模式通过亮度递进表达层级，而非阴影
4. **提供浅色双主题** → 日间使用，暖白背景

### 2.2 色彩来源

基于 `color-palettes.md` 第 14 套「生产力青绿」的 Teal 方向排除（不适合文学场景），改用**自定义暖灰 + 琥珀**方案，灵感来自：
- Tailwind stone 色阶（warm gray 基底）
- 原项目金棕色 accent 的精炼升级
- iA Writer / Bear 等写作工具的暖色调暗色模式

### 2.3 深色主题（默认——写作工具主要在夜间使用）

**HSL 格式（shadcn/ui CSS 变量标准）：**

```css
:root[data-theme="dark"], .dark {
  /* ── 基础表面层（A1-identity）── */
  --background: 24 6% 7%;           /* #110F0D - 暖炭黑，非紫非纯黑 */
  --foreground: 36 8% 88%;           /* #E5DFD6 - 暖灰白，非纯白 */

  /* ── 卡片/容器层 ── */
  --card: 24 5% 10%;                /* #181612 - 卡片背景 */
  --card-foreground: 36 8% 88%;

  /* ── 弹出层（高于卡片）── */
  --popover: 24 5% 12%;             /* #1E1B16 - 下拉/弹窗背景 */
  --popover-foreground: 36 8% 88%;

  /* ── 主色（琥珀/蜂蜜）── */
  --primary: 34 72% 56%;            /* #D89757 - 温暖琥珀，精炼版金棕 */
  --primary-foreground: 24 6% 7%;   /* 深色文字 on primary */

  /* ── 次要色 ── */
  --secondary: 24 5% 14%;           /* #252220 - 次要按钮/标签背景 */
  --secondary-foreground: 36 6% 78%;

  /* ── 静音/辅助色 ── */
  --muted: 24 4% 14%;               /* #232120 - 静音背景 */
  --muted-foreground: 30 3% 52%;   /* #89857F - 次要文字，对比度 ≥ 4.5:1 */

  /* ── 强调色（与 primary 同色，用于 hover/active 状态高亮）── */
  --accent: 34 72% 56%;
  --accent-foreground: 24 6% 7%;

  /* ── 危险/错误色 ── */
  --destructive: 0 63% 50%;         /* #D23A3A - 降饱和红，暗色模式适配 */
  --destructive-foreground: 36 8% 95%;

  /* ── 边框/输入/焦点环 ── */
  --border: 24 4% 17%;              /* #2B2825 - 微妙暖灰边框 */
  --input: 24 4% 17%;
  --ring: 34 72% 56%;               /* 焦点环 = 主色 */

  /* ── 语义色（A2）── */
  --success: 142 52% 45%;           /* #3A9B5A - 降饱和绿 */
  --warning: 38 82% 55%;            /* #E0A82E - 琥珀黄 */
  --info: 200 70% 55%;              /* #2E9BE0 - 信息蓝 */

  /* ── 圆角 ── */
  --radius: 0.5rem;                /* 8px 全局基准 */
  --radius-sm: calc(var(--radius) - 4px);  /* 4px */
  --radius-md: calc(var(--radius) - 2px);  /* 6px */
  --radius-lg: var(--radius);              /* 8px */
  --radius-xl: calc(var(--radius) + 4px);  /* 12px */
}
```

**亮度递进层级（替代阴影表达深度）：**

```
Level 0 (Canvas):     --background  #110F0D  (24° 6% 7%)
Level 1 (Card):       --card        #181612  (24° 5% 10%)  +3% lightness
Level 2 (Popover):    --popover     #1E1B16  (24° 5% 12%) +5% lightness
Level 3 (Tooltip):    #252220       (24° 5% 14%) +7% lightness
```

### 2.4 浅色主题（日间模式）

```css
:root, :root[data-theme="light"] {
  /* ── 基础表面层 ── */
  --background: 40 20% 97%;           /* #FAF7F2 - 暖纸白，非冷白 */
  --foreground: 24 10% 12%;           /* #231F1A - 暖深棕，非纯黑 */

  /* ── 卡片层 ── */
  --card: 0 0% 100%;                  /* #FFFFFF - 纯白卡片 */
  --card-foreground: 24 10% 12%;

  /* ── 弹出层 ── */
  --popover: 0 0% 100%;
  --popover-foreground: 24 10% 12%;

  /* ── 主色 ── */
  --primary: 32 65% 48%;              /* #B8732E - 深琥珀，浅色模式需更深 */
  --primary-foreground: 40 20% 97%;  /* 暖白文字 on primary */

  /* ── 次要色 ── */
  --secondary: 40 15% 92%;            /* #EFE9DF - 暖灰背景 */
  --secondary-foreground: 24 8% 25%;

  /* ── 静音/辅助色 ── */
  --muted: 40 12% 93%;               /* #F0EBE2 */
  --muted-foreground: 24 5% 42%;     /* #6B6660 - 次要文字 */

  /* ── 强调色 ── */
  --accent: 32 65% 48%;
  --accent-foreground: 40 20% 97%;

  /* ── 危险色 ── */
  --destructive: 0 72% 48%;          /* #D12121 */
  --destructive-foreground: 0 0% 100%;

  /* ── 边框/输入/焦点环 ── */
  --border: 35 12% 88%;              /* #DDD7CD - 暖灰边框 */
  --input: 35 12% 88%;
  --ring: 32 65% 48%;

  /* ── 语义色 ── */
  --success: 142 52% 38%;            /* #2E8A4A */
  --warning: 38 82% 45%;             /* #C99121 */
  --info: 200 70% 48%;               /* #1E7FCC */

  /* ── 圆角 ── */
  --radius: 0.5rem;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

### 2.5 色彩使用规则

| 规则 | 说明 |
|------|------|
| **每屏 ≤2 处 accent** | primary/accent 仅用于：主 CTA 按钮、选中 Tab、关键数据高亮 |
| **中性色占 85%+** | background / card / muted / border 主导画面 |
| **accent ≤10%** | 琥珀色仅在需要用户注意时出现 |
| **语义色 ≤5%** | success/warning/destructive 仅用于状态指示 |
| **深色模式亮度递进** | card 比 background 亮 3-5%，popover 比 card 亮 2-3%，用亮度替代阴影 |
| **禁止纯黑纯白** | 深色不用 #000，浅色不用纯白文字 |
| **深色降饱和** | 深色模式语义色比浅色模式饱和度降低 15-20% |

### 2.6 与原项目配色对比

| 维度 | 原项目 | 新方案 | 变更原因 |
|------|--------|--------|----------|
| 背景主色 | #191930（暗紫） | #110F0D（暖炭黑） | **P0 违规：紫色背景必须替换** |
| 卡片背景 | #21213a（紫灰） | #181612（暖深灰） | 消除紫色调 |
| 侧边栏 | #0e0e1a（暗紫蓝） | #0D0C0A（暖炭黑） | 消除紫色调 |
| 主色 | #d4a574（金棕） | #D89757（琥珀） | 保留温暖意象，精炼色值 |
| 文字主色 | #e2dcd0（暖白） | #E5DFD6（暖灰白） | 微调，保持文学感 |
| 次要文字 | #9b94a8（紫灰） | #89857F（暖灰） | 消除紫色调 |
| 边框 | #2a2a42（紫灰） | #2B2825（暖灰） | 消除紫色调 |
| 进度条渐变 | #a67c52→#d4a574 | 纯色 #D89757 | 禁止渐变文字/渐变填充作为 AI 模板味 |

---

## 3. 字体方案

### 3.1 设计意图

AutoWrite 是小说创作工具，字体需同时满足：
1. **UI 文字**：清晰、紧凑、适合工具界面（标签、按钮、表单）
2. **文学内容**：衬线体，适合长时间阅读小说文本（章节内容、大纲）
3. **等宽**：配置/代码块显示

### 3.2 字体配对方案

基于 `typography-pairings.md` 决策树：
- 行业 = 写作工具/内容创作 → 关键词"readable + editorial"
- 人格 = 温暖专业 → Sans（UI）+ Serif（文学内容）
- 场景 = 桌面应用 + 长文阅读 → 正文 ≥16px

**选定配对：Inter（UI）+ Noto Serif SC（文学）+ JetBrains Mono（等宽）**

| 用途 | 字体 | 系统回退 | 字重 |
|------|------|----------|------|
| UI 标题/正文 | Inter | -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif | 400/500/600 |
| 文学内容（章节/大纲） | Noto Serif SC | "Songti SC", "SimSun", "STSong", serif | 400/500 |
| 等宽（配置/代码） | JetBrains Mono | "Cascadia Code", "Fira Code", "Consolas", monospace | 400 |

### 3.3 CSS @import

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

> **Tauri 注意事项**：Tauri 应用无法依赖 CDN 加载字体（离线场景）。需要将字体文件（woff2）打包到 `src/assets/fonts/` 并通过 `@font-face` 本地引用。建议仅打包 Inter Regular/Medium/Semibold + Noto Serif SC Regular/Medium + JetBrains Mono Regular，总计约 800KB（子集化后可降至 300KB）。

### 3.4 字号阶梯（7 级）

| Token | 字号 | 用途 | 行高 |
|-------|------|------|------|
| --text-xs | 12px | 标签、徽章、辅助信息 | 1.4 |
| --text-sm | 14px | 次要正文、表单标签 | 1.5 |
| --text-base | 16px | 正文、按钮文字 | 1.6 |
| --text-lg | 18px | 小标题、卡片标题 | 1.5 |
| --text-xl | 20px | 页面二级标题 | 1.4 |
| --text-2xl | 24px | 页面主标题 | 1.3 |
| --text-3xl | 32px | 章节标题（文学） | 1.2 |

### 3.5 字重体系（3 级）

| 级别 | 字重 | 用途 |
|------|------|------|
| Regular | 400 | 正文、说明文字、文学内容 |
| Medium | 500 | 按钮文字、表单标签、小标题 |
| Semibold | 600 | 页面标题、强调文字 |

### 3.6 字距规则

| 场景 | 字距 | 示例 |
|------|------|------|
| 正文（14-18px） | 0 | 章节内容、表单 |
| 小字（11-13px） | 0.01em | 标签、辅助信息 |
| 标题（≥24px） | -0.01em | 页面标题 |
| 章节标题（文学） | 0.02em | 中文衬线标题需正字距增加可读性 |

### 3.7 文学内容排版精规

章节内容区域（替换原 `.chapter-body` 和 `.streaming-area`）：

```css
.chapter-content {
  font-family: var(--font-literary);  /* Noto Serif SC */
  font-size: 17px;                     /* 比正文略大，阅读舒适 */
  line-height: 2.0;                    /* 中文文学行高加宽 */
  letter-spacing: 0.02em;              /* 中文微正字距 */
  text-indent: 2em;                    /* 中文段落首行缩进 */
  color: var(--foreground);
  max-width: 720px;                     /* 阅读区最佳宽度 */
}
```

---

## 4. Design Token 体系（shadcn/ui CSS 变量）

### 4.1 Token 架构映射

```
shadcn/ui 变量          ←  四层 Token 架构
─────────────────────────────────────────────
--background / --foreground     →  A1-identity（品牌核心）
--card / --popover              →  A1-identity
--primary / --primary-foreground →  A1-identity
--secondary / --muted / --accent →  A2-structure（有默认值）
--border / --input / --ring     →  A2-structure
--destructive / --success       →  A2-semantic
--radius                        →  A1-structure
[自定义] --font-literary        →  C-extension（项目专属）
```

### 4.2 完整 CSS 变量定义（globals.css）

```css
@layer base {
  :root {
    --background: 40 20% 97%;
    --foreground: 24 10% 12%;
    --card: 0 0% 100%;
    --card-foreground: 24 10% 12%;
    --popover: 0 0% 100%;
    --popover-foreground: 24 10% 12%;
    --primary: 32 65% 48%;
    --primary-foreground: 40 20% 97%;
    --secondary: 40 15% 92%;
    --secondary-foreground: 24 8% 25%;
    --muted: 40 12% 93%;
    --muted-foreground: 24 5% 42%;
    --accent: 32 65% 48%;
    --accent-foreground: 40 20% 97%;
    --destructive: 0 72% 48%;
    --destructive-foreground: 0 0% 100%;
    --border: 35 12% 88%;
    --input: 35 12% 88%;
    --ring: 32 65% 48%;
    --radius: 0.5rem;

    /* C-extension: 项目专属 */
    --font-ui: "Inter", -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    --font-literary: "Noto Serif SC", "Songti SC", "SimSun", "STSong", serif;
    --font-mono: "JetBrains Mono", "Cascadia Code", "Fira Code", monospace;

    /* 语义色扩展 */
    --success: 142 52% 38%;
    --warning: 38 82% 45%;
    --info: 200 70% 48%;

    /* 间距（4px 基准） */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
    --space-12: 48px;

    /* 动效 */
    --motion-fast: 150ms;
    --motion-base: 200ms;
    --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  }

  .dark {
    --background: 24 6% 7%;
    --foreground: 36 8% 88%;
    --card: 24 5% 10%;
    --card-foreground: 36 8% 88%;
    --popover: 24 5% 12%;
    --popover-foreground: 36 8% 88%;
    --primary: 34 72% 56%;
    --primary-foreground: 24 6% 7%;
    --secondary: 24 5% 14%;
    --secondary-foreground: 36 6% 78%;
    --muted: 24 4% 14%;
    --muted-foreground: 30 3% 52%;
    --accent: 34 72% 56%;
    --accent-foreground: 24 6% 7%;
    --destructive: 0 63% 50%;
    --destructive-foreground: 36 8% 95%;
    --border: 24 4% 17%;
    --input: 24 4% 17%;
    --ring: 34 72% 56%;

    --success: 142 52% 45%;
    --warning: 38 82% 55%;
    --info: 200 70% 55%;
  }
}
```

### 4.3 Tailwind 配置片段

```js
// tailwind.config.ts
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
      },
      fontFamily: {
        sans: ["var(--font-ui)"],
        serif: ["var(--font-literary)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.4rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["2rem", { lineHeight: "2.5rem" }],
      },
    },
  },
};
```

### 4.4 design-tokens.json（机器可读）

```json
{
  "color": {
    "background": { "light": "hsl(40 20% 97%)", "dark": "hsl(24 6% 7%)", "type": "color" },
    "foreground": { "light": "hsl(24 10% 12%)", "dark": "hsl(36 8% 88%)", "type": "color" },
    "card": { "light": "hsl(0 0% 100%)", "dark": "hsl(24 5% 10%)", "type": "color" },
    "primary": { "light": "hsl(32 65% 48%)", "dark": "hsl(34 72% 56%)", "type": "color" },
    "primary-foreground": { "light": "hsl(40 20% 97%)", "dark": "hsl(24 6% 7%)", "type": "color" },
    "secondary": { "light": "hsl(40 15% 92%)", "dark": "hsl(24 5% 14%)", "type": "color" },
    "muted": { "light": "hsl(40 12% 93%)", "dark": "hsl(24 4% 14%)", "type": "color" },
    "muted-foreground": { "light": "hsl(24 5% 42%)", "dark": "hsl(30 3% 52%)", "type": "color" },
    "accent": { "light": "hsl(32 65% 48%)", "dark": "hsl(34 72% 56%)", "type": "color" },
    "destructive": { "light": "hsl(0 72% 48%)", "dark": "hsl(0 63% 50%)", "type": "color" },
    "border": { "light": "hsl(35 12% 88%)", "dark": "hsl(24 4% 17%)", "type": "color" },
    "ring": { "light": "hsl(32 65% 48%)", "dark": "hsl(34 72% 56%)", "type": "color" },
    "success": { "light": "hsl(142 52% 38%)", "dark": "hsl(142 52% 45%)", "type": "color" },
    "warning": { "light": "hsl(38 82% 45%)", "dark": "hsl(38 82% 55%)", "type": "color" },
    "info": { "light": "hsl(200 70% 48%)", "dark": "hsl(200 70% 55%)", "type": "color" }
  },
  "font": {
    "ui": { "value": "Inter, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif", "type": "fontFamily" },
    "literary": { "value": "'Noto Serif SC', 'Songti SC', 'SimSun', 'STSong', serif", "type": "fontFamily" },
    "mono": { "value": "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace", "type": "fontFamily" }
  },
  "radius": {
    "sm": { "value": "4px", "type": "dimension" },
    "md": { "value": "6px", "type": "dimension" },
    "lg": { "value": "8px", "type": "dimension" },
    "xl": { "value": "12px", "type": "dimension" }
  },
  "spacing": {
    "1": "4px", "2": "8px", "3": "12px", "4": "16px",
    "5": "20px", "6": "24px", "8": "32px", "10": "40px", "12": "48px"
  },
  "motion": {
    "fast": "150ms",
    "base": "200ms",
    "ease": "cubic-bezier(0.2, 0, 0, 1)"
  }
}
```

---

## 5. 图标系统选型

### 5.1 推荐方案：Lucide React（继续使用，已在项目中）

| 维度 | 说明 |
|------|------|
| **图标库** | Lucide React（`lucide-react` npm 包） |
| **类型** | SVG 矢量图标，24×24 viewBox，2px 描边 |
| **许可证** | ISC License（可商用） |
| **图标数量** | 1500+ |
| **理由** | 原项目已使用 Lucide，迁移零成本；shadcn/ui 官方推荐图标库；描边风格统一；支持 tree-shaking |
| **尺寸规范** | 16px（行内文字旁）/ 20px（按钮内）/ 24px（独立图标） |
| **颜色** | 使用 `currentColor`，自动跟随文字色 |
| **描边宽度** | 全项目统一 2px（Lucide 默认） |

### 5.2 图标语义映射（7 个页面导航）

| 页面 | 路由 | Lucide 图标 | 图标名 |
|------|------|-------------|--------|
| 仪表盘 | / | LayoutDashboard | layout-dashboard |
| 创建小说 | /create | FilePlus | file-plus |
| 大纲管理 | /outline | ListTree | list-tree |
| 章节管理 | /chapters | BookOpen | book-open |
| 小说配图 | /illustrations | ImagePlus | image-plus |
| 导出小说 | /export | Download | download |
| 模型配置 | /settings | Settings | settings |

### 5.3 禁止项

- 禁止使用 emoji 作为功能图标（P0 规则）
- 禁止混用其他图标库（如 Heroicons、Phosphor 等）
- 禁止自行修改 Lucide 图标的描边宽度

---

## 6. 七个页面 UI 改进方向

### 6.1 Dashboard（仪表盘）

**当前问题**：
- 统计卡片信息单一（仅类型/主题/目标章节）
- 无记忆面板入口（PRD 要求新增）
- Ant Design Collapse 展示世界观/角色体验差
- 进度条用渐变填充（AI 模板味）

**改进方向**：

| 区域 | 改进方案 |
|------|----------|
| **页面头部** | 小说标题用 `font-serif`（Noto Serif SC），24px，下方显示元信息（类型 · 主题 · 目标章节数），用 `text-muted-foreground` |
| **统计卡片** | 3 列网格（grid-cols-3），shadcn Card 组件，每张卡片：图标 + 标签 + 数值。移除渐变进度条，用 shadcn Progress 纯色填充 |
| **创作进度** | 独立 Card，标题"创作进度"，shadcn Progress + 文字"已写 X / Y 章（Z%）"。进度条颜色用 `--primary` 纯色，状态完成时用 `--success` |
| **记忆面板入口（新增）** | Card 组件，标题"三层记忆"，内含 4 个子区域入口：角色状态、情节时间线、悬念清单、情感弧线。每个入口用 Lucide 图标 + 简短描述 + 当前数据条数 |
| **世界观/角色** | 移除 Collapse 折叠面板，改为直接展示 Markdown（react-markdown），用 `prose` 排版样式。内容超长时用 `max-h-[400px] overflow-y-auto` 限高 |
| **最近剧情摘要** | 时间线列表，每条摘要带章节号标签，用 `text-sm text-muted-foreground` |
| **空状态** | 未创建小说时：居中引导，大标题"开始你的第一部小说"+ 副文"创建小说后，这里会展示创作概览" + shadcn Button"创建小说"跳转 /create |

### 6.2 CreateNovel（创建小说）

**当前问题**：
- Ant Design Form 表单，迁移到 shadcn/ui 需重构
- 提示词模板折叠面板交互笨重
- 覆盖确认 Modal 文案可优化

**改进方向**：

| 区域 | 改进方案 |
|------|----------|
| **表单框架** | shadcn/ui Form（react-hook-form + zod 验证）。表单宽度 `max-w-2xl`（672px）居中 |
| **小说标题** | shadcn Input，placeholder 改为具体示例"如：逆天剑尊"（保留，有实际参考价值） |
| **类型选择** | shadcn Select 组件，8 个选项保留 |
| **主题** | shadcn Input，placeholder"如：逆天改命、修仙" |
| **目标章节数** | shadcn Input type=number，min=10 max=1000 |
| **已有小说提示** | 顶部 shadcn Alert（info 变体），显示当前小说标题 + 进度，点击跳转 Dashboard |
| **提示词模板** | shadcn Collapsible 组件（替代 Ant Collapse）。展开后 4 个 Textarea：世界观/角色/大纲/章节提示词。每个 Textarea 带 Label |
| **提交按钮** | shadcn Button variant=default，全宽，loading 态用 shadcn Spinner |
| **覆盖确认** | shadcn AlertDialog（替代 Ant Modal）。危险操作用 variant=destructive |

### 6.3 Outline（大纲管理）

**当前问题**：
- 轮询 hack 需移除
- 三步流式生成 UI 需重构
- 步骤导航使用 Ant Steps

**改进方向**：

| 区域 | 改进方案 |
|------|----------|
| **步骤导航** | 自定义 Stepper 组件（基于 shadcn 原语），3 步：世界观 → 角色设定 → 章节大纲。当前步骤高亮 `--primary`，已完成步骤用 `--success` 勾选标记 |
| **流式生成区** | 替换原 `.streaming-area`：shadcn Card 内含 ScrollArea，Markdown 实时渲染。顶部加载条用 shimmer 动画（保留原效果但用 CSS 变量） |
| **打字机光标** | 保留闪烁光标效果，但颜色用 `--primary` 而非硬编码。支持 `prefers-reduced-motion`（光标常显不闪） |
| **AI 五态** | Loading: 骨架屏 + "AI 正在生成世界观..."；Empty: 首次引导"点击开始生成大纲"；Error: 分类错误 + 重试按钮；Populated: Markdown 展示 + 编辑按钮；Edge: 超长输出截断提示 |
| **三步进度** | 每步完成后自动切换到下一步，顶部进度指示"第 X / 3 步" |

### 6.4 Chapters（章节管理）—— 核心页面

**当前问题**：
- 模块级 `genState` hack（跨组件挂载/卸载保持状态）→ 用 Zustand 替换
- 流式 buffer 刷新机制需优化
- 左右分栏布局

**改进方向**：

| 区域 | 改进方案 |
|------|----------|
| **布局** | 保持左右分栏：左侧章节列表（240px 固定宽）+ 右侧内容区（flex-1）。使用 shadcn ResizablePanelGroup 支持拖拽调整宽度 |
| **章节列表** | shadcn ScrollArea 内含列表，每项：章节号 + 标题 + 字数 + 日期。选中态用 `bg-accent/10` + 左侧 2px `--primary` 指示条（注意：这是导航选中指示，不是卡片彩色左边框反模式） |
| **生成中状态** | 列表底部添加"生成中"项，带脉冲动画指示器（Lucide Loader2 spin） |
| **内容区** | 棋牌标题用 `font-serif`，20px。正文用 `.chapter-content` 样式（Noto Serif SC, 17px, line-height 2.0, text-indent 2em）。内容区 `max-w-[720px] mx-auto` 保证阅读宽度 |
| **流式生成** | 保留打字机效果 + 自动滚动。用 Zustand store 管理 genState（替代模块级变量）。用户手动滚动时暂停自动滚动（保留原逻辑，用 ref 检测） |
| **中止按钮** | 生成中时，内容区顶部显示 shadcn Banner："正在生成第 X 章" + 进度指示 + shadcn Button variant=outline"中止生成" |
| **AI 五态** | Loading: 骨架屏（章节标题 + 段落占位条）；Empty: "暂无章节" + "写第一章"CTA；Error: 错误信息 + 重试；Populated: 正常内容；Edge: 超长章节分页提示 |
| **think 标签过滤** | 保留 `filterThinkTags` 正则逻辑，但提取到 utils 函数 |

### 6.5 Illustrations（小说配图）

**当前问题**：
- Ant Design Tabs → shadcn/ui Tabs
- 图片画廊用自定义 CSS，需迁移到 shadcn 组件
- AI 场景提取反馈不清晰

**改进方向**：

| 区域 | 改进方案 |
|------|----------|
| **Tab 切换** | shadcn Tabs，3 个 Tab：封面 / 角色立绘 / 场景插图。Tab 激活态下划线用 `--primary` |
| **图片生成** | 每个 Tab 内：生成按钮 + 参数选择（尺寸 Select）+ 生成状态 |
| **画廊网格** | CSS Grid `grid-cols-[repeat(auto-fill,minmax(180px,1fr))]`，shadcn Card 包装每张图片。hover 显示删除按钮 |
| **图片预览** | shadcn Dialog 组件做全屏预览（替代自定义 overlay） |
| **AI 五态** | Loading: 图片占位骨架 + "AI 正在生成..."；Empty: 首次引导 + 示例提示词；Error: 错误分类 + 重试 |
| **图片信息** | 每张图下方显示：参考文本 + 尺寸，用 `text-xs text-muted-foreground` |

### 6.6 Export（导出小说）

**当前问题**：
- 功能完整，仅需 UI 框架迁移

**改进方向**：

| 区域 | 改进方案 |
|------|----------|
| **格式选择** | 4 个 shadcn Card 作为选择项（MD / TXT / DOCX / PDF），每个卡片显示格式名 + 图标 + 简短说明。选中态用 `border-primary` |
| **导出按钮** | shadcn Button variant=default，导出中显示 loading |
| **进度反馈** | shadcn Progress + 文字"正在导出..." |
| **导出完成** | shadcn Toast 通知 + "打开所在文件夹"按钮 |
| **空状态** | 未创建小说时显示引导 |

### 6.7 Settings（模型配置）

**当前问题**：
- Ant Design Form → shadcn/ui Form
- ProviderCard 自定义组件需迁移
- 表单验证需增强
- 连接测试反馈不清晰

**改进方向**：

| 区域 | 改进方案 |
|------|----------|
| **表单框架** | shadcn/ui Form（react-hook-form + zod）。表单宽度 `max-w-2xl` 居中 |
| **Provider 选择** | 两个 shadcn Card 作为 RadioGroup 选项：OpenAI 兼容 / Ollama 本地。选中态 `border-primary` + `bg-accent/5`。展开/收起用 Collapsible |
| **OpenAI 配置** | 快速预设 Select + API Key Input（password type）+ API 地址 Input + 模型名 Input + 超时 InputNumber |
| **Ollama 配置** | Ollama 地址 Input + 模型选择（OllamaModelSelect 组件保留）+ 上下文窗口 InputNumber + 超时 |
| **连接测试** | 新增"测试连接"按钮，点击后显示 loading → 成功（绿色 Toast"连接成功，模型：xxx"）/ 失败（红色 Toast + 错误详情） |
| **图片配置** | 独立 Card 分区：图片模型 + API 地址 + Token + 尺寸 Select |
| **LoRA 配置** | shadcn 动态数组字段：每行 LoRA 名称 Input + 权重 InputNumber + 删除按钮。底部"添加 LoRA" dashed 按钮 |
| **保存反馈** | 保存成功用 shadcn Toast（替代 Ant message）。已保存状态用 Check 图标 + "已保存"内联提示 |
| **新手引导** | "重新显示新手引导"按钮保留，改用 shadcn Button variant=outline |

---

## 7. 组件设计原则（shadcn/ui 定制方向）

### 7.1 组件定制总则

| 原则 | 说明 |
|------|------|
| **不脱离 shadcn/ui 原语** | 所有组件基于 shadcn/ui + Radix UI 原语构建，不引入第三方组件库 |
| **CSS 变量驱动** | 所有颜色通过 `hsl(var(--token))` 引用，禁止硬编码 hex |
| **CVA 变体管理** | 使用 class-variance-authority 管理组件变体（按钮、卡片、badge 等） |
| **状态完整** | 每个交互组件覆盖 9 态（Default/Hover/Focus/Active/Disabled/Loading/Error/Empty/Success） |
| **无障碍优先** | 所有组件支持键盘导航、`focus-visible`、`aria-label`、`prefers-reduced-motion` |

### 7.2 核心组件定制清单

| 组件 | 定制要点 |
|------|----------|
| **Button** | 4 变体：default（primary 填充）/ secondary（muted 填充）/ outline（border + transparent）/ ghost（transparent）。尺寸：sm（h-8 px-3）/ default（h-10 px-4）/ lg（h-12 px-6）。Loading 态：Spinner + 文字变 muted |
| **Card** | 默认无阴影（flat），hover 时 `border-primary/30`。圆角 `rounded-lg`（8px）。内边距 `p-5`（20px） |
| **Input** | 背景透明（继承 card），`border` 边框，focus 时 `ring-2 ring-primary/30`。Error 态 `border-destructive` + 下方红色错误文字 |
| **Select** | shadcn Select（Radix Select）。下拉面板用 `--popover` 背景。选中项 `text-primary` |
| **Tabs** | 下划线式（underline variant）。激活 Tab 文字 `text-primary`，下划线 `bg-primary` |
| **Progress** | 纯色填充 `bg-primary`，轨道 `bg-muted`。完成态 `bg-success`。无渐变 |
| **ScrollArea** | 用于章节列表、内容区。滚动条 6px 宽，`bg-border` 颜色，hover 加深 |
| **Dialog/AlertDialog** | 背景模糊 `backdrop-blur-sm`，面板 `bg-popover`，圆角 `rounded-xl`（12px） |
| **Toast (Sonner)** | 右下角弹出，`bg-popover` + `border`。4 变体：default/success/warning/error |
| **Badge** | 3 变体：default（secondary 背景）/ outline（border only）/ destructive |
| **Tooltip** | `bg-popover` + `text-popover-foreground`，延迟 300ms，`rounded-md` |
| **Skeleton** | `bg-muted` + `animate-pulse`。用于 AI 生成中的骨架屏 |
| **Empty State** | 自定义组件：Lucide 图标 + 标题 + 描述 + CTA 按钮。居中布局 |

### 7.3 AI 五态组件规范

每个 AI 生成场景必须实现以下 5 个状态组件：

| 状态 | 组件结构 | 视觉 |
|------|----------|------|
| **Loading** | Card 内含 Skeleton（标题 + 3-5 行占位条）+ 底部"AI 正在思考..."文字 + 可选中止按钮 | Skeleton `animate-pulse`，文字 `text-muted-foreground` + Lucide Loader2 spin |
| **Empty** | 居中布局：Lucide 图标 48px + 标题 + 描述 + CTA 按钮 | 图标 `text-muted-foreground/50`，标题 `text-lg font-medium` |
| **Error** | Card 内含：错误图标 + 错误分类标题 + 错误详情 + 重试按钮 | `border-destructive/30`，图标 `text-destructive`，重试 Button variant=default |
| **Populated** | 正常内容展示 + 交互操作按钮 | 标准配色 |
| **Edge** | 内容截断提示 + "展开全部"按钮 | 截断处渐隐遮罩 `bg-gradient-to-b from-transparent to-background` |

### 7.4 流式生成组件规范

| 要素 | 规范 |
|------|------|
| **打字机光标** | `|` 字符，`text-primary`，`animation: blink 1s step-end infinite`。`prefers-reduced-motion` 时光标常显 |
| **自动滚动** | 流式文本区域监听 scroll 事件，用户未手动滚动时 `scrollTop = scrollHeight`。用户滚动后暂停自动滚动，显示"回到最新"浮动按钮 |
| **中止按钮** | 生成中时顶部固定 Banner：进度指示 + 中止按钮（variant=outline） |
| **shimmer 加载条** | 顶部 2px 高度，`bg-primary/30`，`animation: shimmer 2s ease-in-out infinite`。支持 reduced-motion |
| **think 标签过滤** | `filterThinkTags(text)` 工具函数，正则 `/<think[\s\S]*?<\/think>/g` 过滤 |

### 7.5 记忆面板组件规范（新功能）

| 子组件 | 数据源 | 展示方式 |
|--------|--------|----------|
| **角色状态卡片** | context.yaml → characters (name/location/power_level/status) | 卡片网格，每张卡显示角色名 + 位置 + 力量等级 + 状态 Badge |
| **情节时间线** | context.yaml → plot_events | 垂直时间线，每个事件节点：章节号 + 事件摘要 |
| **悬念清单** | context.yaml → tension_checklist (open/resolved) | 清单列表，open 项用 `text-warning` 圆点，resolved 项用 `text-success` 勾选 |
| **情感弧线** | context.yaml → emotional_arc (tag+intensity) | 简易折线图（可用 Recharts 或自定义 SVG），X 轴章节，Y 轴 intensity |
| **叙事意图** | context.yaml → current_intent (character_wants/obstacle/reader_should_care) | Card 内三行结构化展示 |

---

## 8. 布局与间距

### 8.1 全局布局

```
┌──────────────────────────────────────────────────┐
│  Sidebar (220px)  │  Header (48px)              │
│  - Logo            │  - 目录路径 + 选择目录按钮   │
│  - Nav Menu        ├──────────────────────────────┤
│  - (7 items)       │  Content Area               │
│                    │  - padding: 24px 32px       │
│                    │  - bg: card                │
│                    │  - rounded-lg              │
│                    │  - overflow-y: auto        │
│                    │                             │
│  220px fixed       │  flex-1                     │
└──────────────────────────────────────────────────┘
```

### 8.2 间距基准（4px 网格）

仅允许：`4 8 12 16 20 24 32 40 48 64 80`
禁止：`5 7 13 15 22 30` 等非标值

### 8.3 容器最大宽度

| 用途 | 宽度 | Tailwind |
|------|------|----------|
| 表单页（创建小说/设置） | 672px | max-w-2xl |
| 内容阅读区（章节） | 720px | max-w-[720px] |
| 标准页面 | 1280px | max-w-7xl |

### 8.4 节区间距

| 断点 | 节区间距 |
|------|----------|
| 桌面 (≥1024px) | 32px |
| 平板 (768-1024px) | 24px |
| 手机 (<768px) | 16px |

---

## 9. 动效规范

| 场景 | 时长 | 缓动 |
|------|------|------|
| 按钮 hover/active | 150ms | ease-out |
| 输入框 focus | 150ms | ease-out |
| 卡片 hover 边框 | 200ms | ease-out |
| 页面淡入 | 300ms | ease-out |
| Modal/Dialog 进入 | 200ms | ease-out |
| 打字机光标闪烁 | 1s step-end infinite | - |
| shimmer 加载条 | 2s ease-in-out infinite | - |

**必须支持 `prefers-reduced-motion`**：
- 打字机光标常显不闪
- shimmer 动画停止
- 页面淡入改为 0ms 即现

---

## 10. Do's & Don'ts

### Do's

1. 使用 CSS 变量引用所有颜色（`hsl(var(--token))`）
2. 深色模式通过亮度递进表达层级（background → card → popover 逐渐变亮）
3. 文学内容用 Noto Serif SC 衬线体，行高 2.0，首行缩进 2em
4. 所有 AI 生成场景覆盖 5 态（Loading/Empty/Error/Populated/Edge）
5. 流式生成支持用户手动滚动暂停 + 中止按钮
6. 使用 Lucide React 统一图标库，尺寸 16/20/24px
7. 组件状态完整覆盖（至少 Default/Hover/Focus/Active/Disabled/Loading）
8. 支持 `prefers-reduced-motion`

### Don'ts

1. **禁止紫色系背景**（原项目 #191930/#21213a 暗紫必须替换）
2. **禁止紫色→粉色渐变**（P0-2 规则）
3. **禁止 emoji 作为功能图标**（P0-1 规则）
4. **禁止硬编码颜色值**（唯一例外：`#fff` `#000`）
5. **禁止渐变文字**（`background-clip: text` + 渐变）
6. **禁止纯黑 #000000 背景**（导致 OLED smearing + 散光光晕）
7. **禁止纯白 #ffffff 文字 on 深色背景**（halation 效应）
8. **禁止渐变进度条填充**（AI 模板味）
9. **禁止彩色左边框卡片强调**（`border-left: 3px solid accent`）
10. **禁止混用图标库**（仅 Lucide React）
11. **禁止超过 400ms 的动画**
12. **禁止 Ant Design `!important` 覆盖模式**（shadcn/ui 原生支持 CSS 变量）

---

## 11. 响应式与无障碍

### 11.1 响应式策略

AutoWrite 是桌面应用（Tauri），最小窗口宽度 800px。不涉及移动端适配，但需处理窗口缩放：

| 窗口宽度 | 布局调整 |
|----------|----------|
| ≥1280px | 完整布局，侧边栏 220px + 内容区 |
| 1024-1280px | 侧边栏可收起为图标栏 56px |
| 800-1024px | 侧边栏收起，章节页改为上下布局（列表横向滚动） |

### 11.2 无障碍

| 要求 | 实现 |
|------|------|
| 对比度 | 正文 ≥4.5:1，大字 ≥3:1（已验证） |
| 键盘导航 | 所有交互元素 Tab 可达，`focus-visible` 环可见 |
| ARIA 标签 | 图标按钮必须有 `aria-label` |
| 触摸目标 | 最小 44×44px（桌面应用鼠标点击为主，但仍需保证） |
| reduced-motion | 所有动画支持 `prefers-reduced-motion: reduce` |
| 屏幕阅读器 | 状态变化用 `aria-live="polite"` 通知 |

---

## 附录：原项目问题诊断清单

| 问题 | 严重度 | 位置 | 解决方案 |
|------|--------|------|----------|
| 暗紫色背景 #191930 | P0 | globals.css | 替换为暖炭黑 #110F0D |
| 暗紫色背景 #21213a | P0 | globals.css | 替换为 #181612 |
| 暗紫色背景 #111120 | P0 | App.tsx ConfigProvider | 替换为 #110F0D |
| 进度条渐变填充 | P1 | globals.css `.ant-progress-bg` | 改为纯色填充 |
| 模块级 genState hack | P1 | Chapters.tsx | 用 Zustand store 替换 |
| Ant Design `!important` 覆盖 | P1 | globals.css 全文 | shadcn/ui 原生 CSS 变量，无需覆盖 |
| 侧边栏选中态彩色左边框 | P2 | globals.css `.ant-menu-item-selected::before` | 改为背景高亮 + 左侧 2px 指示条 |
| Microsoft YaHei 系统字体 | P2 | App.tsx | 替换为 Inter + Noto Sans SC |
| 楷体 KaiTi 系统字体 | P2 | globals.css `--font-literary` | 替换为 Noto Serif SC |
| "欢迎来到小说大批发" | P2 | Layout.tsx Tour | 改为具体功能引导文案 |
