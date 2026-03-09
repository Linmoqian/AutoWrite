# AI 小说自动化创作系统

基于 Ollama 本地大模型的 24 小时自动化小说创作和发布系统。

## 功能特性

- **本地大模型**: 使用 Ollama 部署 DeepSeek/Qwen 等模型，无需 API 费用
- **多智能体创作**: 世界观 → 角色 → 大纲 → 章节，全流程自动化
- **多类型支持**: 玄幻、都市、言情、科幻等多种小说类型
- **自动发布**: 通过浏览器自动化发布到番茄小说平台
- **定时调度**: 24 小时无人值守运行，定时生成和发布章节

## 系统架构

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
│  │              (APScheduler + 24h 守护进程)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 环境准备

**安装 Ollama** (Mac):
```bash
# 方法 1: Homebrew
brew install ollama

# 方法 2: 官网下载
# 访问 https://ollama.com 下载 macOS 安装包
```

**启动 Ollama 服务**:
```bash
ollama serve
```

**下载推荐模型**:
```bash
# DeepSeek 7B (推荐，中文能力强)
ollama pull deepseek-r1:7b

# 备选: Qwen 7B
ollama pull qwen2.5:7b
```

### 2. 安装项目依赖

```bash
# 创建 conda 环境
conda env create -f environment.yml
conda activate auto_novel

# 或使用 pip
pip install -r requirements.txt

# 安装 Playwright 浏览器
playwright install chromium
```

### 3. 配置

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置
vim .env
```

### 4. 使用

**创建新小说**:
```bash
python main.py create --title "我的修仙小说" --genre xuanhuan --theme 修仙 --chapters 100
```

**撰写章节**:
```bash
python main.py write --novel-id <小说ID>
```

**查看小说列表**:
```bash
python main.py list
```

**查看小说详情**:
```bash
python main.py show <小说ID> --show-outline
```

**登录番茄小说**:
```bash
python main.py login
```

**启动守护进程** (24h 自动化):
```bash
# 首先创建配置文件 data/novels.json
python main.py daemon
```

## 配置说明

### .env 文件

```env
# Ollama 配置
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:7b

# 创作配置
NOVEL_TYPE=xuanhuan
CHAPTERS_PER_DAY=2
WORDS_PER_CHAPTER=3000
```

### data/novels.json (守护进程配置)

```json
[
  {
    "novel_id": "abc12345",
    "book_id": "番茄小说书籍ID",
    "auto_publish": true,
    "schedule": {
      "hour": 10,
      "minute": 0
    }
  }
]
```

## 项目结构

```
auto_novel/
├── __init__.py
├── config.py              # 配置管理
├── cli.py                 # 命令行界面
├── models/
│   └── ollama_client.py   # Ollama 客户端
├── agents/
│   ├── prompts.py         # 提示词模板
│   ├── novel_state.py     # 小说状态
│   └── novel_manager.py   # 创作管理器
├── publisher/
│   ├── browser_manager.py # 浏览器管理
│   └── fanqie_publisher.py# 番茄小说发布器
└── scheduler/
    ├── task_scheduler.py  # 任务调度器
    └── novel_job.py       # 小说任务
main.py                    # 主入口
requirements.txt           # 依赖
environment.yml            # Conda 环境
```

## 支持的小说类型

| 类型 | 代码 | 核心元素 |
|------|------|----------|
| 玄幻 | xuanhuan | 修炼、灵气、境界、法宝、宗门 |
| 都市 | dushi | 都市生活、职场、爱情、商战 |
| 言情 | yanqing | 爱情、情感、缘分、成长 |
| 科幻 | kehuan | 未来世界、科技、太空、人工智能 |

## 注意事项

1. **Ollama 内存需求**: 7B 模型约需 8GB 内存，M4 Mac 16GB 可流畅运行
2. **番茄小说登录**: 首次使用需要手动扫码登录，Cookies 会自动保存
3. **生成速度**: 每章 3000 字约需 5-10 分钟（取决于模型和硬件）
4. **内容审核**: 生成的内容建议人工审核后再发布

## 开发

**运行测试**:
```bash
pytest tests/ -v
```

**检查代码**:
```bash
ruff check auto_novel/
```

## License

MIT
