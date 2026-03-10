# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 小说自动化创作与发布系统，基于 Ollama 本地大模型实现 24 小时自动化小说创作，并通过浏览器自动化发布到番茄小说平台。

## 常用命令

### 环境设置

```bash
# 创建 conda 环境
conda env create -f environment.yml
conda activate auto_novel

# 安装 Playwright 浏览器
playwright install chromium
```

### 运行命令

```bash
# 检查 Ollama 服务状态
python main.py check

# 创建新小说
python main.py create --title "小说名" --genre xuanhuan --theme 修仙 --chapters 100

# 撰写章节
python main.py write --novel-id <ID>

# 查看小说列表
python main.py list

# 登录番茄小说（首次使用）
python main.py login

# 启动 24h 守护进程
python main.py daemon
```

### 测试与代码检查

```bash
# 运行所有测试
pytest tests/ -v

# 运行单个测试文件
pytest tests/test_ollama_client.py -v

# 运行单个测试
pytest tests/test_prompts.py::test_get_worldbuilding_prompt -v

# 代码检查
ruff check auto_novel/
```

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     AI 小说自动化系统                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Ollama    │  │  创作管理器  │  │    番茄小说发布器    │  │
│  │  本地推理    │→│ 多智能体协作 │→│   浏览器自动化      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         ↑                                    ↓               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    定时任务调度器                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

1. **创建小说**: `NovelManager.create_novel()` → `NovelState`
2. **构建世界观**: `NovelManager.build_world()` 调用 Ollama 生成
3. **创建角色**: `NovelManager.create_main_character()`
4. **生成大纲**: `NovelManager.generate_outline()`
5. **撰写章节**: `NovelManager.write_chapter()` → `Chapter` 对象
6. **发布章节**: `FanqiePublisher.publish_chapter()` 通过 Playwright 自动化
7. **状态持久化**: `NovelJob._save_state()` → `data/novels/{id}/state.json`

### 核心模块

| 模块 | 职责 |
|------|------|
| `models/ollama_client.py` | Ollama API 封装，支持同步/流式文本生成 |
| `agents/prompts.py` | 小说创作提示词模板（4 种类型） |
| `agents/novel_state.py` | 数据类：NovelState, Chapter, Character |
| `agents/novel_manager.py` | 创作流程编排 |
| `publisher/browser_manager.py` | Playwright 浏览器生命周期管理 |
| `publisher/fanqie_publisher.py` | 番茄小说作家后台自动化 |
| `scheduler/task_scheduler.py` | APScheduler 定时任务 |
| `scheduler/novel_job.py` | 单本小说的完整创作任务封装 |
| `cli.py` | Rich 美化的命令行界面 |

## 支持的小说类型

| 类型 | 代码 | 核心元素 |
|------|------|----------|
| 玄幻 | xuanhuan | 修炼、灵气、境界、法宝、宗门 |
| 都市 | dushi | 都市生活、职场、爱情、商战 |
| 言情 | yanqing | 爱情、情感、缘分、成长 |
| 科幻 | kehuan | 未来世界、科技、太空、人工智能 |

## 配置

环境变量配置见 `.env.example`：
- `OLLAMA_HOST`: Ollama 服务地址（默认 localhost:11434）
- `OLLAMA_MODEL`: 模型名称（推荐 deepseek-r1:7b）
- `CHAPTERS_PER_DAY`: 每日章节数
- `WORDS_PER_CHAPTER`: 每章字数

## 数据目录

```
data/
├── novels/           # 小说状态文件
│   └── {novel_id}/
│       └── state.json
├── novels.json       # 守护进程配置
└── fanqie_cookies.json  # 番茄小说登录态
```

---

## Kanban 前端 (Next.js)

独立的前端看板应用，用于管理小说创作进度。

### 常用命令

```bash
cd kanban

# 开发服务器
npm run dev

# 类型检查
npx tsc --noEmit

# 代码检查
npm run lint

# 生产构建
npm run build
```

### 技术栈

- **Next.js 16** App Router + TypeScript
- **Tailwind CSS 4** 样式
- **@dnd-kit** 拖拽排序
- **zustand** 状态管理（persist 中间件 + localStorage）
- **lucide-react** 图标

### 核心结构

```
kanban/src/
├── app/              # Next.js 页面
├── components/       # React 组件
│   ├── KanbanBoard.tsx   # 主看板（DndContext）
│   ├── KanbanColumn.tsx  # 列容器（useDroppable）
│   ├── NovelCard.tsx     # 卡片（useSortable）
│   └── NovelModal.tsx    # 创建/编辑弹窗
├── store/            # zustand store（kanbanStore.ts）
├── types/            # TypeScript 类型
└── lib/              # 工具函数
```

### 看板状态流转

```
待写(todo) → 撰写中(writing) → 审核中(reviewing) → 已发布(published)
```

拖拽卡片跨列移动时自动更新状态，数据持久化到 localStorage。
