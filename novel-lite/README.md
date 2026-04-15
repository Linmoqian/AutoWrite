# 极简本地小说创作系统

基于 Ollama 的本地小说创作工具，支持 CLI / TUI / Web 三种使用方式。

## 安装

```bash
pip install ollama pyyaml pytest
```

需要 Ollama 服务运行中：`ollama serve`

## 使用方式

### CLI 命令行

```bash
cd novel-lite

# 创建新小说
python write.py new "书名" --genre xuanhuan --theme 修仙 --chapters 100

# 生成大纲（自动包含世界观和角色）
python write.py outline

# 撰写下一章
python write.py write

# 后台持续创作
python batch_write.py

# 润色章节
python polish.py single 1              # 润色单章
python polish.py all                    # 润色全部
python polish.py batch --start 1 --end 10  # 润色指定范围
```

### TUI 终端仪表盘

```bash
python tui.py
```

### Web Dashboard

```bash
# 启动后端 (localhost:8000)
cd novel-lite/web && python server.py

# 启动前端 (localhost:5173)
cd novel-lite/web/client && npm run dev
```

Web Dashboard 特性：
- 流式创作输出：模型生成内容实时显示在预览区
- 创作状态信息：模型名称、启动中、创作中等状态提示
- 模型选择器：动态获取 Ollama 可用模型列表并切换
- 章节阅读器：Markdown 渲染、多主题（深色/浅色/护眼/绿色）、字号调节
- 自动创作模式：循环创作直到目标章数

## 配置

编辑 `config.yaml` 可修改：
- `model`: Ollama 模型名称
- `prompts`: 各类提示词模板

环境变量覆盖：
- `OLLAMA_MODEL`: 覆盖模型配置
- `OLLAMA_TIMEOUT`: 覆盖超时配置

## 文件结构

```
project-dir/
├── novel.md      # 小说元信息和设定
├── outline.md    # 章节大纲
├── context.md    # 创作上下文（滑动窗口摘要）
├── chapters/     # 章节文件
└── polished/     # 润色后的章节
```

## 模块结构

```
novel-lite/
├── config.yaml       # 配置文件（用户可编辑）
├── config.py         # 配置读取
├── files.py          # 文件操作（原子写入、YAML front matter）
├── ai.py             # AI 调用（generate / generate_stream）
├── core.py           # 核心逻辑（Novel 类）
├── cli.py            # 命令行入口
├── write.py          # CLI 入口点
├── batch_write.py    # 后台持续创作
├── polish.py         # 章节润色
├── tui.py            # TUI 终端仪表盘
└── web/              # Web Dashboard
    ├── server.py     # FastAPI 后端
    └── client/       # React + TypeScript 前端
        └── src/components/
            ├── StreamPreview.tsx    # 流式创作预览
            ├── ReaderView.tsx       # 章节阅读器
            ├── ModelSelector.tsx    # 模型选择器
            └── ...
```

## 测试

```bash
cd novel-lite
python -m pytest ../tests/novel_lite/ -v
```

## 注意事项

1. **需要 Ollama 服务**：确保 `ollama serve` 正在运行
2. **工作目录**：CLI/TUI 必须在 `novel-lite/` 目录下运行，Web Dashboard 无此限制
3. **模型推荐**：`qwen3:8b` 或 `deepseek-r1:7b`（中文能力强）
4. **生成时间**：每章约 1-3 分钟（取决于模型和硬件）
5. **可手动编辑**：所有文件都是 Markdown 格式，可直接编辑
