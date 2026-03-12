# 上下文记忆优化实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设计分层存储的上下文记忆系统，压缩数据大小，支持高效检索和 AI 模型读取。

**Architecture:**
- **三层存储架构**: 索引层 (热数据) → 记忆层 (温数据) → 完整层 (冷数据)
- **上下文压缩器**: 将冗长的世界观数据压缩为结构化关键词+向量嵌入
- **摘要链**: 章节通过摘要链递归压缩，保留剧情连贯性

**Tech Stack:** Python dataclasses, Pydantic, JSON/MsgPack 存储, 可选 Sentence Transformers

---

## 文件结构

```
auto_novel/
├── memory/
│   ├── __init__.py
│   ├── base.py           # 基础数据类
│   ├── index.py          # 索引层 (轻量元数据)
│   ├── context.py        # 上下文层 (压缩记忆)
│   ├── compressor.py     # 数据压缩器
│   └── store.py          # 三层存储管理器
├── agents/
│   └── novel_manager.py  # 修改: 使用新的记忆系统
tests/
└── memory/
    ├── test_compressor.py
    ├── test_store.py
    └── test_integration.py
```

---

## Chunk 1: 基础数据类与压缩器

### Task 1: 创建基础数据类型

**Files:**
- Create: `auto_novel/memory/__init__.py`
- Create: `auto_novel/memory/base.py`
- Test: `tests/memory/test_base.py`

- [ ] **Step 1: 写基础数据类**

```python
# auto_novel/memory/base.py
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum


class CompressionLevel(str, Enum):
    """压缩级别"""
    FULL = "full"       # 完整数据
    SUMMARY = "summary" # 摘要
    KEYWORDS = "keywords"  # 关键词


@dataclass
class WorldIndex:
    """世界观索引 - 轻量级元数据"""
    name: str
    genre: str
    theme: str
    keywords: List[str] = field(default_factory=list)
    element_tags: List[str] = field(default_factory=list)
    location_count: int = 0
    character_count: int = 0
    power_system_exists: bool = False


@dataclass
class CharacterIndex:
    """角色索引 - 快速检索"""
    id: str
    name: str
    role: str
    tags: List[str] = field(default_factory=list)
    first_appearance: int = 0  # 首次出现章节
    last_appearance: int = 0
    importance: float = 0.0  # 0-1 重要性评分


@dataclass
class ChapterIndex:
    """章节索引 - 元数据"""
    number: int
    title: str
    summary: str  # 100-200字摘要
    word_count: int
    characters: List[str] = field(default_factory=list)  # 出场角色ID
    locations: List[str] = field(default_factory=list)   # 场景
    key_events: List[str] = field(default_factory=list)  # 关键事件标签
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ContextWindow:
    """上下文窗口 - AI生成时需要的压缩上下文"""
    world_brief: str  # 世界观简介（300字内）
    main_characters: Dict[str, str]  # {name: 一行描述}
    recent_summary: str  # 最近章节摘要（500字内）
    current_goal: str  # 当前章节目标
    tone: str  # 基调风格
```

- [ ] **Step 2: 写测试**

```python
# tests/memory/test_base.py
import pytest
from auto_novel.memory.base import WorldIndex, CharacterIndex, ChapterIndex, ContextWindow


def test_world_index_creation():
    index = WorldIndex(
        name="修仙世界",
        genre="xuanhuan",
        theme="修仙",
        keywords=["灵气", "境界"],
        element_tags=["修炼", "法宝"]
    )
    assert index.name == "修仙世界"
    assert index.location_count == 0


def test_character_index_importance():
    index = CharacterIndex(
        id="char_1",
        name="张三",
        role="protagonist",
        importance=1.0
    )
    assert index.importance == 1.0
    assert index.first_appearance == 0


def test_chapter_index_summary_truncation():
    index = ChapterIndex(
        number=1,
        title="第一章",
        summary="a" * 300,  # 测试截断
        word_count=2000
    )
    assert len(index.summary) == 300  # 暂不截断，由压缩器处理


def test_context_window_structure():
    window = ContextWindow(
        world_brief="修仙世界，灵气复苏",
        main_characters={"张三": "主角"},
        recent_summary="张三开始修炼",
        current_goal="突破第一层",
        tone="热血"
    )
    assert len(window.main_characters) == 1
```

- [ ] **Step 3: 运行测试确认失败**

```bash
pytest tests/memory/test_base.py -v
```

Expected: ModuleNotFoundError

- [ ] **Step 4: 创建模块文件**

```python
# auto_novel/memory/__init__.py
from .base import (
    WorldIndex,
    CharacterIndex,
    ChapterIndex,
    ContextWindow,
    CompressionLevel,
)

__all__ = [
    "WorldIndex",
    "CharacterIndex",
    "ChapterIndex",
    "ContextWindow",
    "CompressionLevel",
]
```

- [ ] **Step 5: 运行测试确认通过**

```bash
pytest tests/memory/test_base.py -v
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add auto_novel/memory/ tests/memory/
git commit -m "feat(med): 添加基础记忆数据类"
```

---

### Task 2: 实现上下文压缩器

**Files:**
- Create: `auto_novel/memory/compressor.py`
- Test: `tests/memory/test_compressor.py`

- [ ] **Step 1: 写压缩器接口与测试**

```python
# tests/memory/test_compressor.py
import pytest
from auto_novel.memory.compressor import ContextCompressor


def test_compress_world_info():
    compressor = ContextCompressor()

    world_info = {
        "world_name": "修仙世界",
        "background": "这是一个灵气复苏的世界，修仙者可以通过吸收天地灵气来提升自己的境界。修仙界分为十大宗门，每个宗门都有自己的传承和秘境。",
        "elements": {"修炼": "吸收灵气提升境界", "法宝": "修仙者使用的武器"},
        "locations": [
            {"name": "青云宗", "description": "正道大宗"},
            {"name": "血月谷", "description": "魔道据点"}
        ],
        "power_system": {
            "levels": ["炼气", "筑基", "金丹", "元婴"],
            "rules": "每一层都需要突破瓶颈"
        }
    }

    brief = compressor.compress_world(world_info, max_length=300)
    assert len(brief) <= 350  # 允许少量溢出
    assert "修仙" in brief
    assert "青云宗" in brief or "大宗" in brief


def test_compress_character():
    compressor = ContextCompressor()

    character = {
        "name": "张三",
        "identity": "青云宗外门弟子",
        "personality": {
            "特征": ["坚毅", "善良", "热血"],
            "习惯": "每日修炼",
            "说话方式": "直爽"
        },
        "background": {
            "出身": "农家子弟",
            "经历": ["偶然获得修炼功法", "加入青云宗"],
            "动机": "保护家人"
        },
        "abilities": {
            "主要能力": ["火焰术", "炼气期三层"],
            "强项": ["意志坚定"],
            "弱点": ["实力低微"]
        }
    }

    brief = compressor.compress_character(character)
    assert "张三" in brief
    assert len(brief) < 100  # 一行描述


def test_compress_chapter_summary_chain():
    compressor = ContextCompressor()

    chapters = [
        "第一章：张三在山中偶然发现一本修仙功法，开始尝试修炼。",
        "第二章：张三突破炼气期一层，引起村里人的注意。",
        "第三章：青云宗使者来到村里，张三被选中入门。"
    ]

    chain = compressor.compress_summary_chain(chapters, max_length=500)
    assert len(chain) <= 550
    assert "修仙功法" in chain or "功法" in chain
    assert "青云宗" in chain


def test_extract_keywords():
    compressor = ContextCompressor()

    text = "张三在青云宗修炼火焰术，目标是突破到筑基期。他遇到了李四，两人成为好友。"

    keywords = compressor.extract_keywords(text, top_k=10)
    assert len(keywords) <= 10
    assert isinstance(keywords, list)


def test_build_character_index():
    compressor = ContextCompressor()

    character = {
        "name": "张三",
        "identity": "主角",
        "personality": {"特征": ["坚毅", "善良"]},
        "background": {"动机": "保护家人"}
    }

    index = compressor.build_character_index(character, chapter_num=1)
    assert index.name == "张三"
    assert index.importance > 0
    assert index.first_appearance == 1
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/memory/test_compressor.py -v
```

Expected: ModuleNotFoundError

- [ ] **Step 3: 实现压缩器**

```python
# auto_novel/memory/compressor.py
import re
from typing import Dict, List, Any, Optional
from collections import Counter

from .base import WorldIndex, CharacterIndex, ChapterIndex


class ContextCompressor:
    """上下文压缩器 - 将完整数据压缩为高效格式"""

    def __init__(self):
        self.stopwords = {
            "的", "了", "是", "在", "和", "与", "或", "但是", "然后",
            "因为", "所以", "如果", "虽然", "一个", "这个", "那个"
        }

    def compress_world(self, world_info: Dict[str, Any], max_length: int = 300) -> str:
        """压缩世界观信息为简介"""
        parts = []

        # 世界名称和背景
        name = world_info.get("world_name", "")
        background = world_info.get("background", "")
        if background:
            # 取前两句
            sentences = re.split(r'[。！？]', background)
            background_brief = sentences[0] if sentences else background
            parts.append(f"{name}：{background_brief}")

        # 核心元素
        elements = world_info.get("elements", {})
        if elements:
            element_items = [f"{k}({v[:20]}...)" if len(v) > 20 else f"{k}({v})"
                           for k, v in list(elements.items())[:3]]
            parts.append(f"核心元素：{'，'.join(element_items)}")

        # 力量体系
        power = world_info.get("power_system", {})
        levels = power.get("levels", [])
        if levels:
            parts.append(f"境界：{'→'.join(levels[:5])}")  # 最多显示5个境界

        # 主要地点
        locations = world_info.get("locations", [])
        if locations:
            loc_names = [loc["name"] for loc in locations[:3]]
            parts.append(f"主要地点：{', '.join(loc_names)}")

        brief = "。".join(parts)
        if len(brief) > max_length:
            brief = brief[:max_length-3] + "..."

        return brief

    def compress_character(self, character: Dict[str, Any]) -> str:
        """压缩角色为一行描述"""
        name = character.get("name", "")
        identity = character.get("identity", "")

        # 提取关键特征
        personality = character.get("personality", {})
        traits = personality.get("特征", [])[:2]  # 最多2个特征

        # 提取动机
        background = character.get("background", {})
        motivation = background.get("动机", "")

        parts = [name, identity]
        if traits:
            parts.append("、".join(traits))
        if motivation:
            parts.append(f"志在{motivation}")

        return "，".join(parts)

    def compress_summary_chain(
        self, summaries: List[str], max_length: int = 500
    ) -> str:
        """压缩章节摘要链为连贯摘要"""
        if not summaries:
            return ""

        # 简单拼接并截断
        combined = "；".join(summaries)

        if len(combined) <= max_length:
            return combined

        # 按比例截取
        ratio = max_length / len(combined)
        target_count = max(1, int(len(summaries) * ratio))

        truncated = "；".join(summaries[:target_count])
        if len(truncated) > max_length:
            truncated = truncated[:max_length-3] + "..."

        return truncated

    def extract_keywords(self, text: str, top_k: int = 10) -> List[str]:
        """提取关键词（简单词频统计）"""
        # 分词（简单按空格和标点）
        words = re.findall(r'[\u4e00-\u9fa5]{2,4}', text)

        # 过滤停用词
        words = [w for w in words if w not in self.stopwords and len(w) >= 2]

        # 统计频率
        counter = Counter(words)
        return [w for w, _ in counter.most_common(top_k)]

    def build_character_index(
        self, character: Dict[str, Any], chapter_num: int = 0
    ) -> CharacterIndex:
        """构建角色索引"""
        name = character.get("name", "")
        role = character.get("identity", "minor")

        # 提取标签
        tags = []

        personality = character.get("personality", {})
        traits = personality.get("特征", [])
        tags.extend(traits[:2])

        abilities = character.get("abilities", {})
        main_abilities = abilities.get("主要能力", [])
        tags.extend(main_abilities[:2])

        # 计算重要性
        importance = 0.5
        if role in ["protagonist", "主角"]:
            importance = 1.0
        elif role in ["antagonist", "反派"]:
            importance = 0.8
        elif role in ["mentor", "导师"]:
            importance = 0.6

        return CharacterIndex(
            id=f"char_{name}_{chapter_num}",
            name=name,
            role=role,
            tags=list(set(tags)),
            first_appearance=chapter_num,
            last_appearance=chapter_num,
            importance=importance
        )

    def build_chapter_index(
        self,
        number: int,
        title: str,
        content: str,
        summary: str = "",
        characters: List[str] = None,
    ) -> ChapterIndex:
        """构建章节索引"""
        # 提取关键词作为关键事件
        keywords = self.extract_keywords(summary or content, top_k=5)

        # 提取场景（简单规则：包含"在""来到""进入"等词的短语）
        locations = []
        location_patterns = re.findall(r'(?:在|来到|进入|来到)([^，。]{2,8})', content)
        locations = list(set(location_patterns))[:3]

        return ChapterIndex(
            number=number,
            title=title,
            summary=summary[:200] if summary else "",
            word_count=len(content),
            characters=characters or [],
            locations=locations,
            key_events=keywords,
        )

    def build_world_index(self, world_info: Dict[str, Any]) -> WorldIndex:
        """构建世界观索引"""
        locations = world_info.get("locations", [])
        power_system = world_info.get("power_system", {})

        # 提取元素标签
        elements = world_info.get("elements", {})
        element_tags = list(elements.keys())

        # 提取关键词
        background = world_info.get("background", "")
        keywords = self.extract_keywords(background, top_k=10)

        return WorldIndex(
            name=world_info.get("world_name", ""),
            genre="",  # 从外部传入
            theme="",  # 从外部传入
            keywords=keywords,
            element_tags=element_tags,
            location_count=len(locations),
            character_count=0,  # 从外部统计
            power_system_exists=bool(power_system.get("levels"))
        )
```

- [ ] **Step 4: 运行测试**

```bash
pytest tests/memory/test_compressor.py -v
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add auto_novel/memory/compressor.py tests/memory/test_compressor.py
git commit -m "feat(med): 实现上下文压缩器"
```

---

## Chunk 2: 三层存储管理器

### Task 3: 实现索引层存储

**Files:**
- Create: `auto_novel/memory/index.py`
- Test: `tests/memory/test_index.py`

- [ ] **Step 1: 写索引层测试**

```python
# tests/memory/test_index.py
import pytest
from pathlib import Path
import tempfile
import json

from auto_novel.memory.index import IndexStore
from auto_novel.memory.base import WorldIndex, CharacterIndex, ChapterIndex


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


def test_index_store_init(temp_dir):
    store = IndexStore(temp_dir / "test.json")
    assert store.path == temp_dir / "test.json"


def test_save_and_load_world_index(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    world_index = WorldIndex(
        name="修仙世界",
        genre="xuanhuan",
        theme="修仙",
        keywords=["灵气", "境界"]
    )

    store.save_world_index("novel_1", world_index)

    loaded = store.load_world_index("novel_1")
    assert loaded.name == "修仙世界"
    assert loaded.genre == "xuanhuan"


def test_save_and_load_character_indices(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    chars = [
        CharacterIndex(
            id="char_1",
            name="张三",
            role="protagonist",
            importance=1.0,
            first_appearance=1
        ),
        CharacterIndex(
            id="char_2",
            name="李四",
            role="supporting",
            importance=0.5,
            first_appearance=2
        )
    ]

    store.save_character_indices("novel_1", chars)

    loaded = store.load_character_indices("novel_1")
    assert len(loaded) == 2
    assert loaded[0].name == "张三"


def test_save_and_load_chapter_indices(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    chapters = [
        ChapterIndex(
            number=1,
            title="第一章",
            summary="张三开始修仙",
            word_count=2000,
            characters=["char_1"]
        )
    ]

    store.save_chapter_indices("novel_1", chapters)

    loaded = store.load_chapter_indices("novel_1")
    assert len(loaded) == 1
    assert loaded[0].number == 1


def test_query_characters_by_importance(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    chars = [
        CharacterIndex(id="c1", name="A", role="protagonist", importance=1.0),
        CharacterIndex(id="c2", name="B", role="supporting", importance=0.5),
        CharacterIndex(id="c3", name="C", role="antagonist", importance=0.8),
    ]

    store.save_character_indices("novel_1", chars)

    # 查询重要角色 (>0.6)
    important = store.query_characters("novel_1", min_importance=0.6)
    assert len(important) == 2
    assert all(c.importance >= 0.6 for c in important)


def test_query_chapters_by_character(temp_dir):
    store = IndexStore(temp_dir / "index.json")

    chapters = [
        ChapterIndex(number=1, title="C1", summary="", word_count=1000, characters=["A", "B"]),
        ChapterIndex(number=2, title="C2", summary="", word_count=1000, characters=["A"]),
        ChapterIndex(number=3, title="C3", summary="", word_count=1000, characters=["C"]),
    ]

    store.save_chapter_indices("novel_1", chapters)

    # 查询角色A出现的章节
    result = store.query_chapters_by_character("novel_1", "A")
    assert len(result) == 2
    assert result[0].number in [1, 2]
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/memory/test_index.py -v
```

Expected: ModuleNotFoundError

- [ ] **Step 3: 实现索引层**

```python
# auto_novel/memory/index.py
import json
from pathlib import Path
from typing import List, Optional, Dict
from dataclasses import asdict

from .base import WorldIndex, CharacterIndex, ChapterIndex


class IndexStore:
    """索引层存储 - 轻量级元数据，常驻内存"""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

        # 内存缓存
        self._world_indices: Dict[str, WorldIndex] = {}
        self._character_indices: Dict[str, List[CharacterIndex]] = {}
        self._chapter_indices: Dict[str, List[ChapterIndex]] = {}

    def _load_all(self):
        """加载所有索引到内存"""
        if not self.path.exists():
            return

        with open(self.path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for novel_id, world_data in data.get("worlds", {}).items():
            self._world_indices[novel_id] = WorldIndex(**world_data)

        for novel_id, chars_data in data.get("characters", {}).items():
            self._character_indices[novel_id] = [
                CharacterIndex(**c) for c in chars_data
            ]

        for novel_id, ch_data in data.get("chapters", {}).items():
            self._chapter_indices[novel_id] = [
                ChapterIndex(**c) for c in ch_data
            ]

    def _save_all(self):
        """保存所有索引到磁盘"""
        data = {
            "worlds": {
                k: asdict(v) for k, v in self._world_indices.items()
            },
            "characters": {
                k: [asdict(c) for c in chars]
                for k, chars in self._character_indices.items()
            },
            "chapters": {
                k: [asdict(c) for c in chapters]
                for k, chapters in self._chapter_indices.items()
            }
        }

        with open(self.path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_world_index(self, novel_id: str, index: WorldIndex):
        self._world_indices[novel_id] = index
        self._save_all()

    def load_world_index(self, novel_id: str) -> Optional[WorldIndex]:
        if novel_id in self._world_indices:
            return self._world_indices[novel_id]

        self._load_all()
        return self._world_indices.get(novel_id)

    def save_character_indices(self, novel_id: str, indices: List[CharacterIndex]):
        self._character_indices[novel_id] = indices
        self._save_all()

    def load_character_indices(self, novel_id: str) -> List[CharacterIndex]:
        if novel_id in self._character_indices:
            return self._character_indices[novel_id]

        self._load_all()
        return self._character_indices.get(novel_id, [])

    def save_chapter_indices(self, novel_id: str, indices: List[ChapterIndex]):
        self._chapter_indices[novel_id] = indices
        self._save_all()

    def load_chapter_indices(self, novel_id: str) -> List[ChapterIndex]:
        if novel_id in self._chapter_indices:
            return self._chapter_indices[novel_id]

        self._load_all()
        return self._chapter_indices.get(novel_id, [])

    def query_characters(
        self, novel_id: str, min_importance: float = 0.0
    ) -> List[CharacterIndex]:
        """查询角色，按重要性筛选"""
        chars = self.load_character_indices(novel_id)
        return [c for c in chars if c.importance >= min_importance]

    def query_chapters_by_character(
        self, novel_id: str, character_name: str
    ) -> List[ChapterIndex]:
        """查询某角色出现的章节"""
        chapters = self.load_chapter_indices(novel_id)
        return [c for c in chapters if character_name in c.characters]
```

- [ ] **Step 4: 运行测试**

```bash
pytest tests/memory/test_index.py -v
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add auto_novel/memory/index.py tests/memory/test_index.py
git commit -m "feat(med): 实现索引层存储"
```

---

### Task 4: 实现完整存储管理器

**Files:**
- Create: `auto_novel/memory/store.py`
- Test: `tests/memory/test_store.py`

- [ ] **Step 1: 写存储管理器测试**

```python
# tests/memory/test_store.py
import pytest
from pathlib import Path
import tempfile

from auto_novel.memory.store import MemoryStore
from auto_novel.memory.base import ContextWindow


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


def test_memory_store_init(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)
    assert store.novel_id == "test_novel"


def test_initialize_world(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    world_info = {
        "world_name": "修仙世界",
        "background": "灵气复苏的世界",
        "elements": {"修炼": "吸收灵气"},
        "locations": [{"name": "青云宗", "description": "正道大宗"}],
        "power_system": {"levels": ["炼气", "筑基"]}
    }

    store.initialize_world("xuanhuan", "修仙", world_info)

    # 验证索引创建
    index = store.index_store.load_world_index("test_novel")
    assert index.name == "修仙世界"
    assert index.power_system_exists


def test_add_character(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    character = {
        "name": "张三",
        "identity": "protagonist",
        "personality": {"特征": ["坚毅"]},
        "background": {"动机": "保护家人"}
    }

    store.add_character(character, chapter_num=1)

    chars = store.index_store.load_character_indices("test_novel")
    assert len(chars) == 1
    assert chars[0].name == "张三"
    assert chars[0].importance == 1.0


def test_add_chapter(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    chapter = {
        "number": 1,
        "title": "第一章",
        "content": "张三开始修仙之路。他在山中偶然发现一本功法，开始修炼。" * 10,
        "summary": "张三发现修仙功法",
        "characters": ["张三"]
    }

    store.add_chapter(chapter)

    chapters = store.index_store.load_chapter_indices("test_novel")
    assert len(chapters) == 1
    assert chapters[0].number == 1
    assert chapters[0].word_count > 0


def test_build_context_window(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 初始化世界
    world_info = {
        "world_name": "修仙世界",
        "background": "灵气复苏，修仙者通过吸收灵气提升境界。",
        "elements": {},
        "locations": [],
        "power_system": {}
    }
    store.initialize_world("xuanhuan", "修仙", world_info)

    # 添加角色
    store.add_character({
        "name": "张三",
        "identity": "protagonist",
        "personality": {"特征": ["坚毅", "善良"]},
        "background": {"动机": "保护家人"}
    }, chapter_num=1)

    # 添加章节
    store.add_chapter({
        "number": 1,
        "title": "第一章",
        "content": "张三开始修仙",
        "summary": "张三发现功法开始修炼",
        "characters": ["张三"]
    })

    # 构建上下文窗口
    window = store.build_context_window(
        chapter_num=2,
        current_goal="突破炼气期一层"
    )

    assert isinstance(window, ContextWindow)
    assert "修仙" in window.world_brief
    assert "张三" in window.main_characters
    assert "突破炼气期一层" in window.current_goal
    assert len(window.world_brief) <= 300


def test_query_character_appearances(temp_dir):
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 添加多个章节
    for i in range(1, 4):
        store.add_chapter({
            "number": i,
            "title": f"第{i}章",
            "content": "内容",
            "summary": f"第{i}章摘要",
            "characters": ["张三"] if i <= 2 else []
        })

    appearances = store.query_character_appearances("张三")
    assert len(appearances) == 2
    assert appearances[0].number == 1


def test_compress_size(temp_dir):
    """测试压缩后的数据大小"""
    store = MemoryStore(novel_id="test_novel", data_dir=temp_dir)

    # 添加大量数据
    world_info = {
        "world_name": "W" * 100,
        "background": "背景" * 500,
        "elements": {f"元素{i}": "描述" * 50 for i in range(10)},
        "locations": [{"name": f"地点{i}", "description": "描述" * 30} for i in range(20)],
        "power_system": {"levels": [f"境界{i}" for i in range(10)]}
    }
    store.initialize_world("xuanhuan", "修仙", world_info)

    # 添加100个章节
    for i in range(100):
        store.add_chapter({
            "number": i + 1,
            "title": f"第{i+1}章",
            "content": "内容" * 1000,
            "summary": f"第{i+1}章摘要" * 5,
            "characters": ["角色A", "角色B"]
        })

    # 构建上下文窗口
    window = store.build_context_window(
        chapter_num=101,
        current_goal="继续创作"
    )

    # 验证压缩后的大小
    total_size = (
        len(window.world_brief) +
        len(window.current_goal) +
        len(window.tone) +
        sum(len(k) + len(v) for k, v in window.main_characters.items()) +
        len(window.recent_summary)
    )

    # 总上下文应该远小于原始数据
    assert total_size < 2000  # 目标是2KB以内
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pytest tests/memory/test_store.py -v
```

Expected: ModuleNotFoundError

- [ ] **Step 3: 实现存储管理器**

```python
# auto_novel/memory/store.py
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import asdict

from .base import (
    WorldIndex, CharacterIndex, ChapterIndex,
    ContextWindow, CompressionLevel
)
from .index import IndexStore
from .compressor import ContextCompressor


class MemoryStore:
    """三层存储管理器

    - 索引层: 热数据，常驻内存
    - 上下文层: 温数据，按需加载
    - 完整层: 冷数据，文件存储
    """

    def __init__(self, novel_id: str, data_dir: Path):
        self.novel_id = novel_id
        self.data_dir = Path(data_dir)
        self.novel_dir = self.data_dir / novel_id
        self.novel_dir.mkdir(parents=True, exist_ok=True)

        # 初始化各层存储
        self.index_store = IndexStore(self.novel_dir / "index.json")
        self.compressor = ContextCompressor()

        # 完整数据路径
        self.world_file = self.novel_dir / "world.json"
        self.characters_file = self.novel_dir / "characters.json"
        self.chapters_dir = self.novel_dir / "chapters"
        self.chapters_dir.mkdir(exist_ok=True)

    def initialize_world(
        self, genre: str, theme: str, world_info: Dict[str, Any]
    ):
        """初始化世界观数据"""
        # 保存完整世界观数据
        with open(self.world_file, 'w', encoding='utf-8') as f:
            json.dump(world_info, f, ensure_ascii=False, indent=2)

        # 构建并保存索引
        world_index = self.compressor.build_world_index(world_info)
        world_index.genre = genre
        world_index.theme = theme
        self.index_store.save_world_index(self.novel_id, world_index)

    def add_character(self, character: Dict[str, Any], chapter_num: int = 0):
        """添加角色"""
        # 加载现有角色
        characters = []
        if self.characters_file.exists():
            with open(self.characters_file, 'r', encoding='utf-8') as f:
                characters = json.load(f)

        # 检查是否已存在
        name = character.get("name")
        for i, c in enumerate(characters):
            if c.get("name") == name:
                characters[i] = character  # 更新
                break
        else:
            characters.append(character)

        # 保存完整数据
        with open(self.characters_file, 'w', encoding='utf-8') as f:
            json.dump(characters, f, ensure_ascii=False, indent=2)

        # 更新索引
        indices = self.index_store.load_character_indices(self.novel_id)
        char_index = self.compressor.build_character_index(character, chapter_num)

        # 更新现有或添加新索引
        for i, idx in enumerate(indices):
            if idx.name == name:
                indices[i].last_appearance = chapter_num
                break
        else:
            indices.append(char_index)

        self.index_store.save_character_indices(self.novel_id, indices)

    def add_chapter(self, chapter: Dict[str, Any]):
        """添加章节"""
        number = chapter["number"]

        # 保存完整章节内容
        chapter_file = self.chapters_dir / f"chapter_{number:04d}.json"
        with open(chapter_file, 'w', encoding='utf-8') as f:
            json.dump(chapter, f, ensure_ascii=False, indent=2)

        # 构建并添加索引
        content = chapter.get("content", "")
        chapter_index = self.compressor.build_chapter_index(
            number=number,
            title=chapter.get("title", ""),
            content=content,
            summary=chapter.get("summary", ""),
            characters=chapter.get("characters", [])
        )

        indices = self.index_store.load_chapter_indices(self.novel_id)
        indices.append(chapter_index)
        self.index_store.save_chapter_indices(self.novel_id, indices)

    def build_context_window(
        self,
        chapter_num: int,
        current_goal: str = "",
        max_recent: int = 3
    ) -> ContextWindow:
        """构建AI生成所需的上下文窗口"""
        # 加载世界观数据
        world_info = {}
        if self.world_file.exists():
            with open(self.world_file, 'r', encoding='utf-8') as f:
                world_info = json.load(f)

        # 压缩世界观
        world_brief = self.compressor.compress_world(
            world_info, max_length=300
        )

        # 加载主要角色
        character_indices = self.index_store.query_characters(
            self.novel_id, min_importance=0.6
        )
        main_characters = {}
        if self.characters_file.exists():
            with open(self.characters_file, 'r', encoding='utf-8') as f:
                all_characters = json.load(f)

            char_dict = {c["name"]: c for c in all_characters}
            for idx in character_indices:
                if idx.name in char_dict:
                    brief = self.compressor.compress_character(char_dict[idx.name])
                    main_characters[idx.name] = brief

        # 构建最近章节摘要
        chapter_indices = self.index_store.load_chapter_indices(self.novel_id)
        recent_indices = chapter_indices[-max_recent:] if chapter_indices else []

        recent_summaries = [c.summary for c in recent_indices if c.summary]
        recent_summary = self.compressor.compress_summary_chain(
            recent_summaries, max_length=500
        )

        # 获取基调
        tone = world_info.get("tone", "引人入胜")

        return ContextWindow(
            world_brief=world_brief,
            main_characters=main_characters,
            recent_summary=recent_summary,
            current_goal=current_goal,
            tone=tone
        )

    def get_full_chapter(self, chapter_num: int) -> Optional[Dict[str, Any]]:
        """获取完整章节数据（冷数据加载）"""
        chapter_file = self.chapters_dir / f"chapter_{chapter_num:04d}.json"
        if not chapter_file.exists():
            return None

        with open(chapter_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def query_character_appearances(self, character_name: str) -> List[ChapterIndex]:
        """查询角色出现的所有章节"""
        return self.index_store.query_chapters_by_character(
            self.novel_id, character_name
        )

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        chapter_indices = self.index_store.load_chapter_indices(self.novel_id)
        character_indices = self.index_store.load_character_indices(self.novel_id)
        world_index = self.index_store.load_world_index(self.novel_id)

        total_words = sum(c.word_count for c in chapter_indices)

        return {
            "total_chapters": len(chapter_indices),
            "total_characters": len(character_indices),
            "total_words": total_words,
            "main_characters": len([
                c for c in character_indices if c.importance >= 0.6
            ]),
            "world_name": world_index.name if world_index else None,
        }
```

- [ ] **Step 4: 运行测试**

```bash
pytest tests/memory/test_store.py -v
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add auto_novel/memory/store.py tests/memory/test_store.py
git commit -m "feat(med): 实现三层存储管理器"
```

---

## Chunk 3: 集成与优化

### Task 5: 与 NovelManager 集成

**Files:**
- Modify: `auto_novel/agents/novel_manager.py`
- Test: `tests/memory/test_integration.py`

- [ ] **Step 1: 写集成测试**

```python
# tests/memory/test_integration.py
import pytest
from pathlib import Path
import tempfile
import json

from auto_novel.memory.store import MemoryStore
from auto_novel.agents.novel_manager import NovelManager
from auto_novel.agents.novel_state import NovelState, Chapter, Character


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


def test_novel_state_to_memory_store(temp_dir):
    """测试 NovelState 转换为 MemoryStore"""
    # 创建 NovelState
    state = NovelState(
        id="test_novel",
        title="测试小说",
        genre="xuanhuan",
        theme="修仙",
        world_info="灵气复苏世界",
        characters=[
            Character(
                name="张三",
                role="protagonist",
                description="主角",
                background="农家子弟"
            )
        ],
        chapters=[
            Chapter(
                number=1,
                title="第一章",
                content="张三开始修仙" * 100,
                summary="开始修仙",
                word_count=500
            )
        ],
        total_chapters_planned=100
    )

    # 创建 MemoryStore 并迁移
    store = MemoryStore(novel_id=state.id, data_dir=temp_dir)

    # 初始化世界（从 world_info 转换）
    world_info = {
        "world_name": state.title,
        "background": state.world_info,
        "elements": {},
        "locations": [],
        "power_system": {}
    }
    store.initialize_world(state.genre, state.theme, world_info)

    # 添加角色
    for char in state.characters:
        char_dict = {
            "name": char.name,
            "identity": char.role,
            "personality": {"特征": []},
            "background": {"出身": char.background}
        }
        store.add_character(char_dict)

    # 添加章节
    for ch in state.chapters:
        chapter_dict = {
            "number": ch.number,
            "title": ch.title,
            "content": ch.content,
            "summary": ch.summary,
            "characters": [c.name for c in state.characters]
        }
        store.add_chapter(chapter_dict)

    # 验证
    window = store.build_context_window(chapter_num=2, current_goal="继续创作")

    assert "修仙" in window.world_brief or "灵气" in window.world_brief
    assert "张三" in window.main_characters
    assert store.get_statistics()["total_chapters"] == 1


def test_context_window_size_comparison(temp_dir):
    """比较新旧方式的上下文大小"""
    # 旧方式：直接传完整 NovelState
    old_state = NovelState(
        id="test",
        title="T" * 50,
        genre="xuanhuan",
        theme="修仙",
        world_info="背景" * 200,
        characters=[
            Character(
                name=f"角色{i}",
                role="protagonist",
                description="描述" * 50,
                background="背景" * 50
            ) for i in range(10)
        ],
        chapters=[
            Chapter(
                number=i,
                title=f"第{i}章",
                content="内容" * 500,
                summary="摘要" * 20,
                word_count=2000
            ) for i in range(50)
        ]
    )

    # 新方式：使用 MemoryStore
    store = MemoryStore(novel_id="test", data_dir=temp_dir)
    store.initialize_world("xuanhuan", "修仙", {
        "world_name": old_state.title,
        "background": old_state.world_info,
        "elements": {},
        "locations": [],
        "power_system": {}
    })

    for char in old_state.characters:
        store.add_character({
            "name": char.name,
            "identity": char.role,
            "personality": {},
            "background": {}
        })

    for ch in old_state.chapters:
        store.add_chapter({
            "number": ch.number,
            "title": ch.title,
            "content": ch.content,
            "summary": ch.summary,
            "characters": []
        })

    # 比较大小
    import pickle

    old_size = len(pickle.dumps(old_state))

    window = store.build_context_window(chapter_num=51)
    new_size = len(pickle.dumps(window))

    # 新方式应该显著更小
    compression_ratio = new_size / old_size
    assert compression_ratio < 0.1, f"压缩比例 {compression_ratio:.2%} 应小于 10%"


def test_query_efficiency(temp_dir):
    """测试查询效率"""
    import time

    store = MemoryStore(novel_id="test", data_dir=temp_dir)

    # 添加100个章节
    for i in range(100):
        store.add_chapter({
            "number": i + 1,
            "title": f"第{i+1}章",
            "content": "内容" * 100,
            "summary": f"摘要{i % 10}" * 5,  # 重复摘要
            "characters": ["角色A"] if i % 2 == 0 else []
        })

    # 测试查询角色出现的章节
    start = time.time()
    appearances = store.query_character_appearances("角色A")
    query_time = time.time() - start

    assert len(appearances) == 50
    assert query_time < 0.1  # 应该在100ms内完成
```

- [ ] **Step 2: 运行集成测试**

```bash
pytest tests/memory/test_integration.py -v
```

Expected: PASS (在实现 MemoryStore 后)

- [ ] **Step 3: 更新 novel_manager.py 使用新记忆系统**

```python
# 在 auto_novel/agents/novel_manager.py 中添加导入
from ..memory.store import MemoryStore

class NovelManager:
    def __init__(self, state: NovelState, data_dir: Path = None):
        self.state = state
        self.data_dir = data_dir or Path("data/novels")
        self.memory_store = MemoryStore(
            novel_id=state.id,
            data_dir=self.data_dir
        )

    def initialize_memory(self):
        """初始化记忆系统（从现有状态迁移）"""
        # 如果需要，从 NovelState 初始化 MemoryStore
        # 这里可以添加迁移逻辑
        pass

    async def write_chapter_with_memory(self, chapter_num: int) -> Chapter:
        """使用压缩上下文撰写章节"""
        # 获取大纲
        outline_data = json.loads(self.state.outline) if isinstance(self.state.outline, str) else self.state.outline

        # 构建上下文窗口（压缩版）
        context_window = self.memory_store.build_context_window(
            chapter_num=chapter_num,
            current_goal=f"撰写第{chapter_num}章"
        )

        # 使用压缩后的上下文生成提示词
        prompt = self._build_chapter_prompt_with_context(
            chapter_num=chapter_num,
            outline=outline_data,
            context=context_window
        )

        # 调用 Ollama 生成
        content = await self.llm_client.generate(prompt)

        # ... 其余处理逻辑
```

- [ ] **Step 4: 运行测试确认集成成功**

```bash
pytest tests/memory/ -v
```

Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add auto_novel/agents/novel_manager.py tests/memory/test_integration.py
git commit -m "feat(med): 集成记忆系统到 NovelManager"
```

---

### Task 6: 文档与优化

**Files:**
- Create: `docs/memory-system.md`
- Modify: `README.md`

- [ ] **Step 1: 创建记忆系统文档**

```markdown
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

\`\`\`python
from auto_novel.memory.store import MemoryStore

# 创建存储
store = MemoryStore(novel_id="my_novel", data_dir=Path("data"))

# 初始化世界观
store.initialize_world(genre="xuanhuan", theme="修仙", world_info=...))

# 添加角色
store.add_character({...}, chapter_num=1)

# 添加章节
store.add_chapter({...})

# 构建AI生成上下文
window = store.build_context_window(chapter_num=2, current_goal="突破第一层")

# 传递给 LLM
prompt = build_prompt(window)
\`\`\`

## API 参考

### MemoryStore

\`\`\`python
class MemoryStore:
    def __init__(self, novel_id: str, data_dir: Path)
    def initialize_world(self, genre: str, theme: str, world_info: Dict)
    def add_character(self, character: Dict, chapter_num: int)
    def add_chapter(self, chapter: Dict)
    def build_context_window(self, chapter_num: int, current_goal: str) -> ContextWindow
    def get_full_chapter(self, chapter_num: int) -> Optional[Dict]
    def query_character_appearances(self, character_name: str) -> List[ChapterIndex]
    def get_statistics(self) -> Dict
\`\`\`
```

- [ ] **Step 2: 更新 README**

在 README 中添加记忆系统说明章节。

- [ ] **Step 3: 提交**

```bash
git add docs/memory-system.md README.md
git commit -m "docs(med): 添加记忆系统文档"
```

---

## 完成验证

### 最终测试

```bash
# 运行所有记忆系统测试
pytest tests/memory/ -v

# 运行完整测试套件
pytest tests/ -v

# 验证压缩比
python scripts/verify_memory_compression.py
```

### 验收标准

1. **压缩比**: 上下文窗口大小 < 原始数据的 10%
2. **查询性能**: 角色出现查询 < 100ms
3. **测试覆盖**: 所有单元测试通过
4. **集成测试**: NovelManager 可以使用新的记忆系统

---

**计划完成状态**: 等待执行
