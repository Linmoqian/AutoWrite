# 极简本地小说创作系统

基于 Ollama 本地大模型的 AI 小说创作工具，单脚本 398 行。

## 快速开始

```bash
cd novel-lite
pip install -r requirements-novel.txt

# 设置模型（查看可用: ollama list）
export OLLAMA_MODEL=qwen3:8b

# 创建新小说
python write.py new "逆天剑尊" --genre xuanhuan --theme "逆天改命"

# 一键全流程
python write.py run

# 生成下一章
python write.py next
```

## 命令

| 命令 | 说明 |
|------|------|
| `new` | 创建新小说 |
| `world` | 生成世界观 |
| `character` | 生成角色 |
| `outline` | 生成大纲 |
| `chapter N` | 生成第 N 章 |
| `next` | 生成下一章 |
| `status` | 查看状态 |
| `run` | 一键全流程 |

## 文件结构

```
novel-lite/
├── write.py              # 核心脚本
├── novel.md              # 小说设定
├── outline.md            # 大纲
├── context.md            # 上下文
├── chapters/             # 章节目录
└── requirements-novel.txt
```

## 环境变量

| 变量 | 默认值 |
|------|--------|
| `OLLAMA_MODEL` | `deepseek-r1:7b` |
| `OLLAMA_TIMEOUT` | `300` |

## 设计文档

- [设计文档](docs/superpowers/specs/2026-03-12-minimal-novel-writer-design.md)
- [实现计划](docs/superpowers/plans/2026-03-12-minimal-novel-writer.md)
