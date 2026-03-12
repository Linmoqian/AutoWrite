# 极简本地小说创作系统

## 快速开始

```bash
# 安装依赖
pip install -r requirements-novel.txt

# 创建新小说
python write.py new "修仙传奇" --genre xuanhuan --theme "逆天改命"

# 一键生成（世界观→角色→大纲→第一章）
python write.py run

# 继续生成下一章
python write.py next

# 生成指定章节
python write.py chapter 5

# 查看状态
python write.py status
```

## 环境变量

- `OLLAMA_MODEL`: 模型名称（默认 deepseek-r1:7b）
- `OLLAMA_TIMEOUT`: 超时时间（默认 300秒）

## 命令说明

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
