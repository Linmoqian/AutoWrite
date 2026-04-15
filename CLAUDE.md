# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 小说自动化创作与发布系统，基于 Ollama 本地大模型实现自动化小说创作。当前活跃模块为 `novel-lite`（极简创作系统）。

## 常用命令

所有命令在 `novel-lite/` 目录下执行（`sys.path` 需包含该目录）。

```bash
# 安装依赖
cd novel-lite && pip install -r requirements-novel.txt

# 创作流程（按顺序执行）
python write.py new "书名" --genre xuanhuan --theme 修仙 --chapters 100  # 创建小说
python write.py outline   # 生成大纲（含世界观、角色）
python write.py write     # 撰写下一章

# TUI 仪表盘
python tui.py             # 启动终端仪表盘

# Web Dashboard
cd novel-lite/web && python server.py           # 启动后端 (localhost:8000)
cd novel-lite/web/client && npm run dev          # 启动前端 (localhost:5173)

# 辅助工具
python batch_write.py     # 后台持续创作，循环直到目标章数
python polish.py single 1                       # 润色单章
python polish.py all                           # 润色全部章节
python polish.py batch --start 1 --end 10      # 润色指定范围

# 运行测试（在项目根目录）
pytest tests/novel_lite/              # novel-lite 模块测试
pytest tests/novel_lite/test_core.py  # 单个测试文件
pytest tests/                         # 全部测试

# 切换模型
export OLLAMA_MODEL=qwen3:8b
```

## 架构

### 模块依赖

```
cli.py → core.py → ai.py + files.py + config.py
```

- `config.py` — 加载 `config.yaml`，支持 `OLLAMA_MODEL`/`OLLAMA_TIMEOUT` 环境变量覆盖，模块加载时执行 `CONFIG = load_config()`
- `ai.py` — `generate(prompt)` 调用 Ollama chat API，指数退避重试（最多 3 次），`num_ctx: 4096`
- `files.py` — 所有文件 I/O：YAML front matter 解析/构建、`novel.md`/`outline.md`/`context.md` 的读写、原子写入（先写 `.tmp` 再 rename，带 `.bak` 备份）
- `core.py` — `Novel` 类，核心业务：`create()` → `generate_outline()` → `write_chapter()`
- `cli.py` — argparse 命令行，支持 `new`/`outline`/`write` 三个子命令
- `write.py` — 入口点，仅调用 `cli.main()`

### Prompt 模板

`config.yaml` 定义 5 个 prompt 模板（`world`/`character`/`outline`/`chapter`/`polish`），使用 Python `str.format()` 占位符。模板内容在 `core.py` 中通过 `CONFIG["prompts"][key].format(...)` 渲染。

### 数据文件

| 文件 | 格式 | 说明 |
|------|------|------|
| `novel.md` | YAML front matter + Markdown | 元信息 + 世界观 + 角色 |
| `outline.md` | Markdown（`## 卷名` + `- NNN. 标题`） | 按卷分组的章节大纲 |
| `context.md` | Markdown | 进度 + 最近 5 章摘要（滑动窗口） |
| `chapters/NNN-标题.md` | YAML front matter + 正文 | 章节文件 |
| `polished/` | 同 chapters 格式 | 润色后的章节 |

### 数据流

```
new     → novel.md + context.md
outline → novel.md（追加世界观/角色）+ outline.md
write   → chapters/*.md + context.md（更新进度+摘要）
```

### 关键设计：上下文滑动窗口

每章写完后，`core.py` 会额外调用 AI 生成 200 字剧情摘要，保留最近 5 章摘要到 `context.md`。下一章写作时将 `context.md` 全文作为 prompt 前缀传入，实现长篇小说的连续性。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OLLAMA_MODEL` | `qwen3:8b`（由 config.yaml 决定） | Ollama 模型 |
| `OLLAMA_TIMEOUT` | `300` | 超时秒数 |
| `OLLAMA_TEST_ENABLED` | `false` | 启用真实 Ollama 连接测试 |

## 测试策略

- 所有测试 mock `ai.generate`，不依赖真实 Ollama 服务
- 集成测试需设置 `OLLAMA_TEST_ENABLED=true`
- 测试目录：`tests/novel_lite/`（`test_core.py`、`test_files.py`）
- 根 `conftest.py` 提供 `ollama_enabled` 和 `ollama_host` fixture

## 注意事项

- `cli.py`、`core.py`、`batch_write.py`、`polish.py` 使用相对导入（如 `from ai import generate`），必须在 `novel-lite/` 目录下运行
- `files.py` 中路径常量（`NOVEL_FILE`、`CHAPTERS_DIR` 等）使用相对 `Path`，工作目录必须是 `novel-lite/`
- 生成内容（`chapters/`、`polished/`、`novel.md`、`outline.md`、`context.md` 等）已被 `.gitignore` 排除，不会进入版本控制
