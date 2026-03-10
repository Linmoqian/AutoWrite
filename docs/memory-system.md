# 上下文记忆系统

## 概述

上下文记忆系统采用三层存储架构，优化 AI 小说创作中的数据检索和模型输入效率。

## 三层架构

### 索引层 (Index Layer)
- **用途**: 轻量级元数据，常驻内存
- **内容**: 世界观关键词、角色索引、章节摘要
- **格式**: JSON
- **大小**: 约 1KB/小说

### 上下文层 (Context Layer)
- **用途**: AI 生成时的压缩上下文
- **内容**: 世界观简介、主要角色、最近摘要
- **格式**: ContextWindow 对象
- **大小**: 约 2KB

### 完整层 (Storage Layer)
- **用途**: 完整内容持久化
- **内容**: 世界观详情、完整章节、角色详情
- **格式**: 按章节分割的 JSON 文件
- **大小**: 实际内容大小

## 压缩比

| 数据类型 | 原始大小 | 压缩后 | 压缩比 |
|---------|---------|--------|--------|
| 世界观   | ~5KB    | ~300B  | 6%     |
| 角色信息  | ~1KB/个 | ~50B   | 5%     |
| 上下文窗口 | ~50KB   | ~2KB   | 4%     |

## 使用示例

```python
from auto_novel.memory.store import MemoryStore

# 创建存储
store = MemoryStore(novel_id="my_novel", data_dir=Path("data"))

# 初始化世界观
store.initialize_world(genre="xuanhuan", theme="修仙", world_info={
    "world_name": "修仙世界",
    "background": "灵气复苏的修仙世界",
    "elements": {},
    "locations": [],
    "power_system": {}
})

# 添加角色
store.add_character({
    "name": "张三",
    "identity": "protagonist",
    "personality": {"特征": ["坚韧"]},
    "background": {"出身": "农家"}
}, chapter_num=1)

# 添加章节
store.add_chapter({
    "number": 1,
    "title": "第一章",
    "content": "张三开始修仙...",
    "summary": "开始修仙之路",
    "characters": ["张三"]
})

# 构建AI生成上下文
window = store.build_context_window(chapter_num=2, current_goal="突破第一层")

# 传递给 LLM
prompt = build_prompt(window)
```

## API 参考

### MemoryStore

```python
class MemoryStore:
    def __init__(self, novel_id: str, data_dir: Path)
    def initialize_world(self, genre: str, theme: str, world_info: Dict)
    def add_character(self, character: Dict, chapter_num: int)
    def add_chapter(self, chapter: Dict)
    def build_context_window(self, chapter_num: int, current_goal: str) -> ContextWindow
    def get_full_chapter(self, chapter_num: int) -> Optional[Dict]
    def query_character_appearances(self, character_name: str) -> List[ChapterIndex]
    def get_statistics(self) -> Dict
```

### ContextWindow

```python
@dataclass
class ContextWindow:
    world_brief: str          # 压缩后的世界观 (~300字)
    main_characters: Dict     # 主要角色简介
    recent_summary: str       # 最近章节摘要链 (~500字)
    current_goal: str         # 当前创作目标
    tone: str                 # 故事基调
```

## 模块结构

```
auto_novel/memory/
├── __init__.py
├── base.py           # 数据类定义
├── index.py          # 索引层存储
├── compressor.py     # 上下文压缩器
└── store.py          # 三层存储管理器
```

## 测试

```bash
# 运行所有记忆系统测试
pytest tests/memory/ -v

# 运行集成测试
pytest tests/memory/test_integration.py -v
```
