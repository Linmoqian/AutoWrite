# 极简本地小说创作系统

基于 Ollama 的本地小说创作工具，已重构为模块化结构。

## 安装

```bash
pip install ollama pyyaml pytest
```

## 使用

```bash
# 创建新小说
python write.py new "书名" --genre xuanhuan --theme 修仙 --chapters 100

# 生成大纲（自动包含世界观和角色）
python write.py outline

# 撰写下一章
python write.py write
```

## 配置

编辑 `config.yaml` 可修改：
- `model`: Ollama 模型名称
- `prompts`: 各类提示词模板

环境变量覆盖：
- `OLLAMA_MODEL`: 覆盖模型配置
- `OLLAMA_TIMEOUT`: 覆盖超时配置

## 文件结构

```
├── novel.md      # 小说元信息和设定
├── outline.md    # 章节大纲
├── context.md    # 创作上下文
└── chapters/     # 章节文件
```

## 模块结构

```
novel-lite/
├── config.yaml   # 配置文件（用户可编辑）
├── config.py     # 配置读取
├── files.py      # 文件操作
├── ai.py         # AI 调用
├── core.py       # 核心逻辑
├── cli.py        # 命令行入口
└── write.py      # 入口点
```

## 测试

```bash
cd novel-lite
python -m pytest ../tests/novel_lite/ -v
```

## 注意事项

1. **需要 Ollama 服务**：确保 `ollama serve` 正在运行
2. **模型选择**：推荐 `qwen3:8b` 或 `deepseek-r1:7b`（中文能力强）
3. **生成时间**：每章约 1-3 分钟（取决于模型和硬件）
4. **可手动编辑**：所有文件都是 Markdown 格式，可直接编辑
