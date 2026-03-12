# 极简本地小说创作系统设计文档

## 概述

重新设计 AI 小说自动化创作系统的核心架构，遵循**简洁性优先**原则，用最小可行方案实现核心功能。

## 设计目标

- **解决技术债务**：现有系统 AI 交互层、记忆系统、整体架构耦合严重
- **简洁性优先**：砍掉复杂设计，用最简单可靠的方案
- **人类可读**：Markdown 优先，便于查看和手动编辑
- **核心功能**：本地模型 + 创作流程 + 简单存储

## 目录结构

```
novel/
├── write.py           # 唯一脚本（~300行）
├── novel.md           # 元数据 + 世界观 + 角色
├── outline.md         # 章节大纲
├── context.md         # 运行时上下文（自动维护）
└── chapters/
    ├── 001-初入仙门.md
    ├── 002-拜师学艺.md
    └── ...
```

## 文件格式

### novel.md - 元数据 + 世界观 + 角色

```markdown
---
title: 修仙传奇
genre: xuanhuan
theme: 逆天改命
target_chapters: 100
words_per_chapter: 3000
model: deepseek-r1:7b
created: 2024-03-11
---

# 世界观

天地灵气复苏，万族争锋。修炼体系分为练气、筑基、金丹、元婴、化神...
（AI生成，可手动编辑）

# 角色

## 主角：林凡

- 身份：穿越者，前世程序员
- 性格：谨慎、果断、有点腹黑
- 金手指：可看到万物属性面板
- 目标：证道长生

## 配角：苏清雪

- 身份：天剑宗圣女
- 性格：清冷、内心善良
- 与主角关系：从敌到友
```

### outline.md - 章节大纲

```markdown
# 大纲

## 第一卷：初入仙门（1-20章）

- 001. 穿越异界，觉醒金手指
- 002. 拜入天剑宗，沦为外门弟子
- 003. 发现宗门秘境，获得传承
...

## 第二卷：崭露头角（21-50章）

- 021. 宗门大比，一鸣惊人
...
```

### context.md - 运行时上下文（自动生成）

```markdown
# 上下文摘要

## 当前进度
- 已完成：20章
- 下一章：021-宗门大比

## 剧情摘要（最近5章）
第16章：林凡突破筑基...
第17章：遭遇暗杀...
...

## 角色状态
- 林凡：筑基中期，刚获得神秘传承
- 苏清雪：金丹初期，对主角态度缓和

## 待埋伏笔
- 神秘传承的来历
- 暗杀背后的势力
```

### chapters/*.md - 章节文件

```markdown
---
chapter: 1
title: 初入仙门
words: 3124
created: 2024-03-11
---

# 第一章 初入仙门

（正文内容...）
```

## 命令设计

```bash
python write.py new "修仙传奇" --genre xuanhuan --theme "逆天改命"
python write.py world                    # 生成世界观
python write.py character                # 生成主角和配角
python write.py outline                  # 生成大纲
python write.py chapter [编号]           # 写指定章节
python write.py run                      # 一键跑完全流程
```

## 核心代码结构

```python
# write.py 简化结构

import ollama
import yaml
from pathlib import Path

# ========== Ollama 调用 ==========
def generate(prompt: str, context: str = "") -> str:
    """调用 Ollama 生成文本"""
    full_prompt = f"{context}\n\n{prompt}" if context else prompt
    response = ollama.chat(model=MODEL, messages=[{"role": "user", "content": full_prompt}])
    return response["message"]["content"]

# ========== 文件操作 ==========
def read_novel() -> dict: ...
def write_novel(data: dict): ...
def read_outline() -> list: ...
def read_context() -> str: ...
def update_context(chapter_num: int): ...
def write_chapter_file(num: int, title: str, content: str): ...

# ========== 生成流程 ==========
def gen_world() -> str:      # 生成世界观 → 写入 novel.md
def gen_character() -> str:  # 生成角色 → 写入 novel.md
def gen_outline() -> str:    # 生成大纲 → 写入 outline.md
def gen_chapter(num: int):   # 读取上下文 → 生成 → 写入文件 → 更新上下文

# ========== CLI 入口 ==========
def main():
    if sys.argv[1] == "new": ...
    elif sys.argv[1] == "world": gen_world()
    elif sys.argv[1] == "character": gen_character()
    elif sys.argv[1] == "outline": gen_outline()
    elif sys.argv[1] == "chapter": gen_chapter(...)
    elif sys.argv[1] == "run": ...  # 依次调用上面所有

if __name__ == "__main__":
    main()
```

## 上下文机制

### 写章节流程

```
写章节前                          写章节后
    │                                │
    ▼                                ▼
读取 novel.md                  生成新章节摘要
读取 outline.md                更新角色状态
读取 context.md ──────────────► 追加到 context.md
    │
    ▼
构造完整上下文 Prompt
    │
    ▼
调用 Ollama 生成
```

### 上下文构造

```python
def build_chapter_prompt(chapter_num: int) -> str:
    """构造写章节的完整 Prompt"""

    novel = read_novel()           # 世界观 + 角色
    outline = read_outline()       # 获取本章大纲
    context = read_context()       # 最近剧情摘要

    chapter_outline = get_chapter_outline(outline, chapter_num)

    prompt = f"""
## 设定
{novel['world']}

## 角色
{format_characters(novel['characters'])}

## 剧情进度
{context}

## 本章任务
第{chapter_num}章：{chapter_outline}

## 要求
- 字数：{novel['words_per_chapter']}字
- 风格：{novel['genre']}类型，{novel['theme']}主题
- 承接上文，推进剧情
- 章末留悬念

请直接输出章节内容，不要有额外说明。
"""
    return prompt
```

### 上下文更新

```python
def update_context(chapter_num: int, new_content: str):
    """写完章节后更新 context.md"""

    # 1. 用 Ollama 生成本章摘要（~200字）
    summary = generate(f"请用200字概括以下章节的剧情：\n{new_content}")

    # 2. 更新 context.md
    context = {
        "current_chapter": chapter_num,
        "recent_summaries": [..., summary],  # 保留最近5章
        "character_states": extract_character_changes(new_content),
        "pending_plots": extract_pending_plots(new_content)
    }
    write_context(context)
```

**关键约束**：
- 上下文总长度控制在 ~2000 字以内
- 最近5章摘要滚动更新

## 提示词模板

### 世界观生成

```python
WORLD_PROMPT = """
请为一部{genre}类型的小说创建世界观设定。

主题：{theme}
要求：
1. 修炼/能力体系（3-5个等级）
2. 世界背景（势力分布、历史背景）
3. 特色元素（2-3个独特的设定）
4. 字数：500-800字

直接输出世界观内容，不要有标题和额外说明。
"""
```

### 角色生成

```python
CHARACTER_PROMPT = """
基于以下世界观，创建小说角色：

{world}

要求创建：
1. 主角（1人）：要有独特的金手指或优势
2. 重要配角（2-3人）：与主角有明确关系

每个角色包含：姓名、身份、性格、与主角关系、目标

直接输出角色信息，用列表格式。
"""
```

### 大纲生成

```python
OUTLINE_PROMPT = """
基于以下设定，生成小说大纲：

## 世界观
{world}

## 角色
{characters}

## 要求
- 总章数：{total_chapters}章
- 分卷规划（每卷20-30章）
- 每章一行，格式：章节号. 标题
- 主线清晰，有起承转合

直接输出大纲，按卷分组。
"""
```

### 章节生成

```python
CHAPTER_PROMPT = """
{context}

## 本章任务
第{num}章：{title}

## 大纲描述
{outline_detail}

## 要求
- 字数：{words}字
- 风格：{style}
- 场景描写细腻，对话生动
- 章末留悬念或转折

直接输出章节正文内容。
"""
```

## 技术栈

| 组件 | 选择 | 说明 |
|------|------|------|
| 语言 | Python 3.10+ | 类型提示、pathlib |
| LLM | Ollama | 本地运行，`ollama` SDK |
| 存储 | Markdown + YAML | 人类可读，git 友好 |
| 依赖 | 仅 `ollama` | 最小化依赖 |

## 与现有系统对比

| 维度 | 现有系统 | 新系统 |
|------|----------|--------|
| 代码量 | ~2000行 | ~300行 |
| 存储格式 | JSON | Markdown |
| 记忆系统 | 三层架构 | 单文件摘要 |
| 模块数 | 10+ | 1 |
| 依赖 | Playwright/FastAPI/... | 仅 ollama |

## 不在范围内

以下功能**不**包含在新系统核心设计中：

- 多类型小说支持（保留玄幻类型模板，其他手动扩展）
- 自动发布到番茄小说
- Kanban 前端看板
- 24h 守护进程
- 多模型切换

这些可作为后续独立模块添加，不影响核心设计。

## 成功标准

1. **功能**：能完成 世界观 → 角色 → 大纲 → 章节 的完整流程
2. **质量**：生成的章节内容连贯、无明显逻辑冲突
3. **简洁**：核心代码不超过 400 行
4. **可维护**：新人 10 分钟内理解代码结构
