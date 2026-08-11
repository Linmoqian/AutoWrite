# AutoWrite 重构版 UI/UX 设计方向文档 v1

> 生成日期：2026-08-11
> 设计师：designer-research
> 三轴刻度：Variance=4 / Motion=3 / Density=5
> 风格基底：Swiss Minimalism + Micro-interactions + AI-Native UI（克制版）
> 状态：待用户确认

---

## 1. 设计语言选择

### 对标品牌（3 个）

1. **iA Writer** — 极简写作工具代表，"界面隐退"理念
2. **Linear** — 桌面级生产力工具交互标杆，快捷键驱动、信息密度高、深色主题舒适
3. **Sudowrite** — AI 写作工具直接竞品，流式生成体验行业参考

### 设计风格定义：温暖文学风（Warm Literary）

在 Swiss Minimalism 骨架上叠加暖色大地色系，营造"书房/写作台"氛围。深色为主（长时间创作），浅色为辅（日间使用）。

### 设计原则（5 条）

1. **内容即主角** — UI chrome 保持克制，不与内容争夺注意力
2. **暖色护眼** — 全局禁止冷紫色调，采用暖大地色系
3. **流式优先** — AI 生成场景必须有清晰的进度反馈
4. **快捷操作可达** — 高频操作必须有键盘快捷键和明显的主按钮
5. **设计 Token 驱动** — 零硬编码颜色，CSS 变量引用

---

## 2. 配色方案

### 设计意图

- 主色：琥珀棕 `#C8965F`（对应原项目金棕 #d4a574，微调降低饱和度）
- 背景：暖炭灰 `#1A1714`（替换违规暗紫 #191930），色相偏暖（H 20-30°）
- 强调色：青绿 `#5B9D7E`，与琥珀棕互补对比
- 状态色：绿成功、琥珀警告、红错误、蓝信息

### 深色主题（默认）

| 语义角色 | 变量名 | HSL 值 | Hex 参考 |
|---|---|---|---|
| 页面背景 | `--background` | `20 10% 9%` | #1A1714 |
| 前景文字 | `--foreground` | `35 12% 87%` | #E8E0D5 |
| 卡片背景 | `--card` | `24 10% 13%` | #25211D |
| 卡片文字 | `--card-foreground` | `35 12% 87%` | #E8E0D5 |
| 悬浮/弹窗 | `--popover` | `24 10% 16%` | #2D2924 |
| 主色 | `--primary` | `32 53% 58%` | #C8965F |
| 主色文字 | `--primary-foreground` | `20 10% 9%` | #1A1714 |
| 次要色 | `--secondary` | `24 8% 20%` | #383330 |
| 静音背景 | `--muted` | `22 6% 16%` | #2A2624 |
| 静音文字 | `--muted-foreground` | `38 8% 57%` | #9B9588 |
| 强调色 | `--accent` | `152 28% 49%` | #5B9D7E |
| 危险色 | `--destructive` | `2 68% 51%` | #C53D43 |
| 边框 | `--border` | `22 8% 20%` | #383330 |
| 输入框 | `--input` | `24 10% 11%` | #1E1B18 |
| 聚焦环 | `--ring` | `32 53% 58%` | #C8965F |
| 侧边栏 | `--sidebar` | `15 11% 7%` | #151211 |
| 侧边栏文字 | `--sidebar-foreground` | `35 12% 80%` | #D4CCBF |
| 侧边栏主色 | `--sidebar-primary` | `32 53% 58%` | #C8965F |
| 成功 | `--success` | `134 38% 46%` | #6B9F47 |
| 警告 | `--warning` | `36 65% 54%` | #D49A3F |
| 信息 | `--info` | `205 38% 52%` | #5B89B0 |

### 浅色主题

| 语义角色 | 变量名 | HSL 值 | Hex 参考 |
|---|---|---|---|
| 页面背景 | `--background` | `40 33% 96%` | #FAF7F2 |
| 前景文字 | `--foreground` | `30 14% 15%` | #2A2520 |
| 卡片背景 | `--card` | `0 0% 100%` | #FFFFFF |
| 主色 | `--primary` | `32 45% 45%` | #A6753E |
| 次要色 | `--secondary` | `36 25% 90%` | #EDE5D8 |
| 静音文字 | `--muted-foreground` | `30 7% 45%` | #7A726A |
| 强调色 | `--accent` | `152 28% 40%` | #4E8568 |
| 危险色 | `--destructive` | `2 68% 45%` | #B5343A |
| 边框 | `--border` | `36 12% 84%` | #E0D8CC |
| 侧边栏 | `--sidebar` | `38 33% 94%` | #F5F0E8 |

### 每屏强调色使用规则

- 每屏 ≤ 2 处强调色使用
- primary 仅用于：主 CTA 按钮、选中菜单项、关键数据高亮
- accent（青绿）仅用于：选中态背景、进度条完成态、成功反馈

---

## 3. 字体方案

| 用途 | 字体 | 来源 |
|---|---|---|
| 文学正文 | 霞鹜文楷屏幕阅读版 (LXGW WenKai Screen) | 开源 SIL OFL 1.1 |
| UI 正文/标题 | Inter + Noto Sans SC | Google Fonts |
| 等宽 | JetBrains Mono | Google Fonts |

### 字号体系

| 用途 | Tailwind class | px | 行高 | 字重 |
|---|---|---|---|---|
| 页面标题 | text-2xl | 24px | 1.3 | 600 |
| 区块标题 | text-xl | 20px | 1.3 | 600 |
| 卡片标题 | text-lg | 18px | 1.4 | 500 |
| 正文(UI) | text-sm | 14px | 1.5 | 400 |
| 小字/辅助 | text-xs | 12px | 1.5 | 400 |
| 章节正文 | text-base | 16px | 2.0 | 400 |
| 章节标题 | text-xl | 20px | 1.3 | 500 |

> 章节正文使用 serif 字体 + 2.0 行高 + 2em 首行缩进，营造纸质书阅读体验。

---

## 4. Design Token 体系（完整 CSS 变量定义）

```css
:root {
  /* 浅色主题 */
  --background: 40 33% 96%;
  --foreground: 30 14% 15%;
  --card: 0 0% 100%;
  --card-foreground: 30 14% 15%;
  --popover: 0 0% 100%;
  --popover-foreground: 30 14% 15%;
  --primary: 32 45% 45%;
  --primary-foreground: 40 33% 96%;
  --secondary: 36 25% 90%;
  --secondary-foreground: 30 14% 15%;
  --muted: 38 25% 92%;
  --muted-foreground: 30 7% 45%;
  --accent: 152 28% 40%;
  --accent-foreground: 40 33% 96%;
  --destructive: 2 68% 45%;
  --destructive-foreground: 40 33% 96%;
  --success: 134 35% 38%;
  --success-foreground: 40 33% 96%;
  --warning: 36 65% 45%;
  --warning-foreground: 30 14% 15%;
  --info: 205 38% 45%;
  --info-foreground: 40 33% 96%;
  --border: 36 12% 84%;
  --input: 36 12% 84%;
  --ring: 32 45% 45%;
  --radius: 0.5rem;
  --sidebar: 38 33% 94%;
  --sidebar-foreground: 30 10% 35%;
  --sidebar-primary: 32 45% 45%;
  --sidebar-primary-foreground: 40 33% 96%;
  --sidebar-accent: 36 25% 90%;
  --sidebar-accent-foreground: 30 14% 15%;
  --sidebar-border: 36 12% 84%;
  --sidebar-ring: 32 45% 45%;
  --font-sans: 'Inter', 'Noto Sans SC', sans-serif;
  --font-serif: 'LXGW WenKai Screen', '霞鹜文楷屏幕阅读版', 'KaiTi', '楷体', serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
}

.dark {
  /* 深色主题（默认） */
  --background: 20 10% 9%;
  --foreground: 35 12% 87%;
  --card: 24 10% 13%;
  --card-foreground: 35 12% 87%;
  --popover: 24 10% 16%;
  --popover-foreground: 35 12% 87%;
  --primary: 32 53% 58%;
  --primary-foreground: 20 10% 9%;
  --secondary: 24 8% 20%;
  --secondary-foreground: 35 12% 87%;
  --muted: 22 6% 16%;
  --muted-foreground: 38 8% 57%;
  --accent: 152 28% 49%;
  --accent-foreground: 35 12% 97%;
  --destructive: 2 68% 51%;
  --destructive-foreground: 35 12% 97%;
  --success: 134 38% 46%;
  --success-foreground: 35 12% 97%;
  --warning: 36 65% 54%;
  --warning-foreground: 20 10% 9%;
  --info: 205 38% 52%;
  --info-foreground: 35 12% 97%;
  --border: 22 8% 20%;
  --input: 24 10% 11%;
  --ring: 32 53% 58%;
  --sidebar: 15 11% 7%;
  --sidebar-foreground: 35 12% 80%;
  --sidebar-primary: 32 53% 58%;
  --sidebar-primary-foreground: 20 10% 9%;
  --sidebar-accent: 24 10% 13%;
  --sidebar-accent-foreground: 35 12% 87%;
  --sidebar-border: 22 8% 17%;
  --sidebar-ring: 32 53% 58%;
}
```

---

## 5. 图标系统选型

### 推荐：Lucide React（保留现有选型）

**理由**：项目已使用、shadcn/ui 官方推荐、2px stroke 线性图标匹配 Swiss Minimalism、Tree-shakeable。

**图标使用规范**：
- 16px：行内图标、按钮内图标
- 20px：卡片标题图标、导航项图标
- 24px：页面标题图标、空状态图标

**禁止**：emoji 作功能图标、混用其他图标库

---

## 6. 七个页面的 UI 改进方向

### 6.1 Dashboard（仪表盘）
- 布局：上中下三段式
- 顶部：小说标题(serif 24px) + 类型Tag + 环形进度条(80px)
- 中部：4列统计卡片（总章节/已写章节/总字数/最近创作时间）
- 下部：左侧最近章节摘要 + 右侧世界观/角色Accordion
- 空状态：BookOpen图标 + "开始你的第一部作品" + CTA按钮

### 6.2 CreateNovel（创建小说）
- 布局：居中单栏 max-w-2xl
- 已有小说提示：Alert(warning) 替代大卡片
- 表单：标题/类型分两列，shadcn Select替代Ant Design Select
- 提示词模板：Collapsible收起
- 覆盖确认：AlertDialog替代Modal

### 6.3 Outline（大纲管理）
- 布局：左右分栏（280px Stepper + 内容区）
- 左侧：垂直Stepper（3步），完成=accent+check，进行中=primary+Loader2
- 右侧：Tab切换（世界观/角色/章节大纲）
- 流式生成：shimmer进度条 + 流式文本 + 光标闪烁

### 6.4 Chapters（章节管理）
- 布局：保持左右分栏，优化信息密度
- 左侧：章节列表(240px可折叠)，每项显示编号+标题+字数
- 右侧：粘性工具栏(标题+字数+写下一章按钮) + serif正文区
- 流式生成：实时追加文本 + 末尾光标闪烁 + shimmer进度条

### 6.5 Illustrations（小说配图）
- 布局：左右分栏（320px操作面板 + 画廊）
- 左侧：Tabs(封面/角色/场景) + 生成表单
- 右侧：grid画廊，卡片hover显示删除+预览
- 大图预览：Dialog全屏

### 6.6 Export（导出小说）
- 布局：居中单栏 max-w-3xl
- 顶部：信息卡片(grid 3列)
- 格式选择：grid grid-cols-4，选中border-primary + bg-primary/5
- 导出按钮：底部居中 size=lg + Download图标

### 6.7 Settings（模型配置）
- 布局：shadcn Tabs 顶部水平分组
- Tab 1: AI文本模型 — Provider RadioGroup + 动态表单
- Tab 2: 图片生成 — ModelScope配置 + LoRA动态列表
- Tab 3: 提示词模板 — 4个Textarea
- Tab 4: 通用 — 超时时间、新手引导
- 保存：sticky底部操作栏 + Toast反馈

---

## 7. 组件设计原则

### Card 组件
- 默认 border + shadow-sm，hover shadow-md
- 选中态：border-primary + bg-primary/5
- 禁止卡片嵌套卡片

### 表单组件
- focus时border-ring + ring-2 ring-ring/20
- 使用 React Hook Form + Zod
- 错误信息用 text-destructive text-xs

### 流式文本展示组件
- 顶部shimmer进度条（仅生成中显示）
- serif字体16px + leading-[2] + 光标闪烁
- shimmer动画2s循环

### Stepper组件（大纲三步生成）
- 垂直布局，序号圆圈24px
- done=bg-accent+Check / active=bg-primary+Loader2 spin / pending=border-2

### 导航布局
- 侧边栏240px，菜单项高36px
- 选中：bg-sidebar-primary/12 + 左侧3px竖线
- 可折叠为56px图标栏

### 5态覆盖标准
| 状态 | 设计要求 |
|---|---|
| Loading | shimmer + 流式文本 + Loader2 spin |
| Empty | 图标48px + 标题 + 描述 + CTA |
| Error | Alert destructive + 重试按钮 |
| Populated | 完整内容展示 + 交互操作 |
| Edge | 长文本截断 + 上限提醒 |

---

## 8. 补充规范

### 动效规范
- 按钮 hover/press: 150ms ease-out
- 输入框 focus: 150ms ease-out
- 页面内容进入: 200ms ease-out
- shimmer进度条: 2s循环 ease-in-out
- 光标闪烁: 1s循环
- 禁止弹跳缓动 cubic-bezier(0.68, -0.55, 0.265, 1.55)
- 支持 prefers-reduced-motion

### 间距系统
4px网格：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64px
- 卡片内边距：24px（p-6）
- 卡片间距：16px（gap-4）
- 表单字段间距：16px（gap-4）

### 容器最大宽度
- 全宽页面（Chapters）：max-w-full
- 标准页面（Dashboard/Outline）：max-w-5xl
- 表单页面（CreateNovel/Settings）：max-w-2xl居中

### 响应式策略
最小窗口宽度 800px：
- < 800px：侧边栏折叠为图标栏
- 800-1200px：侧边栏展开，内容区单列
- > 1200px：侧边栏展开，内容区可多列

### 当前项目暗紫色违规说明
当前项目 globals.css 中的 --bg-primary: #111120、--bg-surface: #191930、--bg-elevated: #21213a 均为暗紫色调（H 240-260°），违反 P0 规则。本次设计方向替换为暖大地色系（H 15-35°），从根本上消除紫色。
