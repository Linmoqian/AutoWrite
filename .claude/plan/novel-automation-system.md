# Implementation Plan: Automated Novel Writing System

## Task Type
- [x] Backend (Python + Ollama)
- [x] Fullstack (Web Dashboard + API)

## Technical Solution

基于 16GB Mac mini M4 的硬件限制，采用以下技术栈：

### 核心架构
```
┌─────────────────────────────────────────────────────────────┐
│                    Novel Automation System                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Scheduler  │  │  Dashboard  │  │   Notification      │  │
│  │ (APScheduler)│  │  (FastAPI)  │  │   (Email/Telegram)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────▼────────────────▼─────────────────────▼──────────┐  │
│  │                    Core Engine                          │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐  │  │
│  │  │  Outline   │ │  Chapter   │ │   Content Review   │  │  │
│  │  │  Generator │ │  Generator │ │   & Quality Check  │  │  │
│  │  └─────┬──────┘ └─────┬──────┘ └─────────┬──────────┘  │  │
│  │        │              │                  │              │  │
│  │  ┌─────▼──────────────▼──────────────────▼───────────┐ │  │
│  │  │              Memory Layer (RAG + ChromaDB)         │ │  │
│  │  │  - Character profiles  - Plot threads              │ │  │
│  │  │  - World building     - Chapter summaries          │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│         │                                                     │
│  ┌──────▼──────────────────────────────────────────────────┐  │
│  │              Ollama LLM Layer                            │  │
│  │  Primary: Mistral Nemo Instruct 12b (Creative Writing)  │  │
│  │  Fallback: Gemma 3 12b QAT (General Tasks)              │  │
│  └─────────────────────────────────────────────────────────┘  │
│         │                                                     │
│  ┌──────▼──────────────────────────────────────────────────┐  │
│  │           Publishing Layer (番茄小说)                     │  │
│  │  - Selenium/Playwright for browser automation           │  │
│  │  - Cookie-based authentication                          │  │
│  │  - Anti-detection measures                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 模型选择（16GB RAM 优化）

| 模型 | 参数量 | 用途 | 内存占用 |
|------|--------|------|----------|
| **Mistral Nemo Instruct 12b** | 12B | 主力写作模型（创意性强） | ~8GB |
| **Gemma 3 12b QAT** | 12B | 备用模型（通用任务） | ~8GB |
| **Qwen 2.5 7b** | 7B | 轻量任务（大纲生成） | ~5GB |

## Implementation Steps

### Phase 1: 基础设施搭建 (Day 1-2)

#### Step 1.1: 环境配置
```bash
# 项目结构
novel-automation/
├── config/
│   ├── settings.yaml          # 全局配置
│   └── prompts/               # Prompt 模板
│       ├── outline.yaml
│       ├── chapter.yaml
│       └── review.yaml
├── src/
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── ollama_client.py   # Ollama API 封装
│   │   └── model_manager.py   # 模型切换管理
│   ├── memory/
│   │   ├── __init__.py
│   │   ├── chromadb_store.py  # 向量数据库
│   │   └── context_builder.py # 上下文构建
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── outline_gen.py     # 大纲生成
│   │   ├── chapter_gen.py     # 章节生成
│   │   └── reviewer.py        # 内容审核
│   ├── publisher/
│   │   ├── __init__.py
│   │   ├── fanqie_client.py   # 番茄小说客户端
│   │   └── anti_detect.py     # 反检测
│   ├── scheduler/
│   │   ├── __init__.py
│   │   └── tasks.py           # 定时任务
│   └── api/
│       ├── __init__.py
│       ├── main.py            # FastAPI 入口
│       └── routes/
├── data/
│   ├── novels/                # 小说存储
│   ├── memory/                # 记忆数据库
│   └── logs/                  # 日志
├── dashboard/                 # Web 前端
├── tests/
├── environment.yml
├── pyproject.toml
└── README.md
```

**Expected Deliverable**: 完整的项目骨架和 Conda 环境配置

#### Step 1.2: Ollama 安装与模型部署
```python
# pseudo-code: src/llm/ollama_client.py
class OllamaClient:
    """Ollama API 客户端封装"""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.client = ollama.Client(host=base_url)
        self.models = {
            "creative": "mistral-nemo:12b",
            "general": "gemma3:12b-qat",
            "light": "qwen2.5:7b"
        }
    
    async def generate(self, prompt: str, model: str = "creative", 
                       context: list[str] = None) -> str:
        """生成文本，支持上下文注入"""
        messages = self._build_messages(prompt, context)
        response = await self.client.chat(
            model=self.models[model],
            messages=messages,
            stream=True
        )
        return self._collect_stream(response)
    
    def _build_messages(self, prompt: str, context: list[str]) -> list:
        """构建带上下文的消息"""
        messages = []
        if context:
            messages.append({
                "role": "system",
                "content": f"参考上下文：\n{chr(10).join(context)}"
            })
        messages.append({"role": "user", "content": prompt})
        return messages
```

**Expected Deliverable**: 可用的 Ollama 客户端，支持模型切换和流式输出

---

### Phase 2: 记忆系统 (Day 3-4)

#### Step 2.1: ChromaDB 向量存储
```python
# pseudo-code: src/memory/chromadb_store.py
class NovelMemoryStore:
    """小说记忆存储系统"""
    
    def __init__(self, persist_dir: str = "./data/memory"):
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collections = {
            "characters": self._get_or_create("characters"),
            "plots": self._get_or_create("plots"),
            "world": self._get_or_create("world_building"),
            "summaries": self._get_or_create("chapter_summaries")
        }
        self.embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    
    def store_character(self, character: CharacterProfile):
        """存储角色信息"""
        embedding = self.embedder.encode(character.to_text())
        self.collections["characters"].add(
            ids=[character.id],
            embeddings=[embedding],
            metadatas=[character.to_dict()],
            documents=[character.to_text()]
        )
    
    def recall_relevant(self, query: str, collection: str, k: int = 5) -> list:
        """检索相关记忆"""
        embedding = self.embedder.encode(query)
        results = self.collections[collection].query(
            query_embeddings=[embedding],
            n_results=k
        )
        return results["documents"][0]
    
    def update_chapter_summary(self, chapter_num: int, summary: str):
        """更新章节摘要"""
        # 自动提取关键信息并存储
        self.collections["summaries"].upsert(
            ids=[f"chapter_{chapter_num}"],
            documents=[summary],
            metadatas=[{"chapter": chapter_num, "created_at": datetime.now().isoformat()}]
        )
```

**Expected Deliverable**: 可用的记忆存储系统，支持角色、情节、世界观、摘要存储

#### Step 2.2: 上下文构建器
```python
# pseudo-code: src/memory/context_builder.py
class ContextBuilder:
    """智能上下文构建器"""
    
    def __init__(self, memory_store: NovelMemoryStore, max_tokens: int = 4000):
        self.memory = memory_store
        self.max_tokens = max_tokens
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
    
    def build_writing_context(self, novel_id: str, chapter_num: int) -> WritingContext:
        """构建写作上下文"""
        context = WritingContext()
        
        # 1. 获取大纲
        context.outline = self._get_outline(novel_id)
        
        # 2. 获取相关角色（基于当前章节预览）
        relevant_chars = self.memory.recall_relevant(
            query=context.outline.chapters[chapter_num].preview,
            collection="characters",
            k=10
        )
        context.characters = relevant_chars
        
        # 3. 获取最近3章摘要
        recent_summaries = self._get_recent_summaries(novel_id, chapter_num, n=3)
        context.recent_summaries = recent_summaries
        
        # 4. 获取活跃情节线
        active_plots = self.memory.recall_relevant(
            query=context.outline.chapters[chapter_num].plot_focus,
            collection="plots",
            k=5
        )
        context.active_plots = active_plots
        
        # 5. Token 预算控制
        context = self._trim_to_budget(context)
        
        return context
    
    def _trim_to_budget(self, context: WritingContext) -> WritingContext:
        """根据 Token 预算裁剪上下文"""
        total_tokens = 0
        for field in ["outline", "characters", "summaries", "plots"]:
            content = getattr(context, field, "")
            tokens = len(self.tokenizer.encode(str(content)))
            if total_tokens + tokens > self.max_tokens:
                # 截断处理
                setattr(context, field, self._truncate(content, self.max_tokens - total_tokens))
                break
            total_tokens += tokens
        return context
```

**Expected Deliverable**: 智能上下文构建器，能根据 Token 预算动态组装上下文

---

### Phase 3: 写作引擎 (Day 5-7)

#### Step 3.1: 大纲生成器
```python
# pseudo-code: src/engine/outline_gen.py
class OutlineGenerator:
    """大纲生成器"""
    
    def __init__(self, llm: OllamaClient, memory: NovelMemoryStore):
        self.llm = llm
        self.memory = memory
    
    async def generate_outline(self, 
                                genre: str, 
                                theme: str, 
                                target_chapters: int = 200,
                                target_words_per_chapter: int = 2000) -> NovelOutline:
        """生成完整大纲"""
        
        # Step 1: 生成核心设定
        core_setting = await self._generate_core_setting(genre, theme)
        
        # Step 2: 生成角色设定
        characters = await self._generate_characters(core_setting, count=10)
        
        # Step 3: 生成世界观
        world_building = await self._generate_world_building(core_setting)
        
        # Step 4: 生成分卷结构
        volumes = await self._generate_volumes(core_setting, target_chapters)
        
        # Step 5: 生成章节大纲
        chapters = await self._generate_chapter_outlines(volumes, characters)
        
        outline = NovelOutline(
            core_setting=core_setting,
            characters=characters,
            world_building=world_building,
            volumes=volumes,
            chapters=chapters,
            metadata={
                "genre": genre,
                "theme": theme,
                "target_chapters": target_chapters,
                "target_words_per_chapter": target_words_per_chapter
            }
        )
        
        # 存储到记忆系统
        self._store_to_memory(outline)
        
        return outline
    
    async def _generate_core_setting(self, genre: str, theme: str) -> CoreSetting:
        prompt = f"""
        请为一部{genre}类型的网络小说生成核心设定。
        主题：{theme}
        
        输出格式：
        - 书名：[吸引人的书名]
        - 一句话简介：[20字以内]
        - 核心冲突：[主角面临的主要矛盾]
        - 金手指/外挂：[主角的特殊能力或优势]
        - 升级体系：[实力提升的路径]
        - 情感线：[感情发展脉络]
        """
        response = await self.llm.generate(prompt, model="creative")
        return self._parse_core_setting(response)
```

**Expected Deliverable**: 可生成完整小说大纲的系统

#### Step 3.2: 章节生成器
```python
# pseudo-code: src/engine/chapter_gen.py
class ChapterGenerator:
    """章节生成器"""
    
    def __init__(self, llm: OllamaClient, 
                 memory: NovelMemoryStore,
                 context_builder: ContextBuilder):
        self.llm = llm
        self.memory = memory
        self.context_builder = context_builder
    
    async def generate_chapter(self, 
                                novel_id: str, 
                                chapter_num: int,
                                target_words: int = 2000) -> Chapter:
        """生成单章内容"""
        
        # 1. 构建上下文
        context = self.context_builder.build_writing_context(novel_id, chapter_num)
        
        # 2. 获取章节大纲
        chapter_outline = context.outline.chapters[chapter_num]
        
        # 3. 构建写作 Prompt
        prompt = self._build_writing_prompt(context, chapter_outline, target_words)
        
        # 4. 分段生成（控制长度）
        content = await self._generate_in_segments(prompt, target_words)
        
        # 5. 后处理
        content = self._post_process(content)
        
        # 6. 生成摘要并更新记忆
        summary = await self._generate_summary(content)
        self.memory.update_chapter_summary(chapter_num, summary)
        
        # 7. 提取并更新角色/情节信息
        await self._extract_and_update_info(content, chapter_num)
        
        return Chapter(
            number=chapter_num,
            title=chapter_outline.title,
            content=content,
            summary=summary,
            word_count=len(content)
        )
    
    async def _generate_in_segments(self, prompt: str, target_words: int) -> str:
        """分段生成长章节"""
        segments = []
        current_words = 0
        segment_count = 0
        
        while current_words < target_words:
            segment_prompt = f"{prompt}\n\n当前进度：已生成 {current_words} 字，目标 {target_words} 字。"
            if segments:
                segment_prompt += f"\n上一段结尾：\n{segments[-1][-200:]}\n\n请继续："
            
            segment = await self.llm.generate(segment_prompt, model="creative")
            segments.append(segment)
            current_words += len(segment)
            segment_count += 1
            
            # 安全限制
            if segment_count > 10:
                break
        
        return "\n\n".join(segments)
    
    def _build_writing_prompt(self, context: WritingContext, 
                               chapter_outline: ChapterOutline,
                               target_words: int) -> str:
        prompt = f"""
## 写作任务
你是一位专业的网络小说作家，请根据以下信息撰写第{chapter_outline.number}章。

## 章节要求
- 标题：{chapter_outline.title}
- 主要情节：{chapter_outline.plot_summary}
- 涉及角色：{chapter_outline.characters}
- 情感基调：{chapter_outline.mood}
- 目标字数：{target_words}字

## 上下文信息

### 本书核心设定
{context.outline.core_setting}

### 相关角色
{context.characters}

### 最近章节摘要
{context.recent_summaries}

### 活跃情节线
{context.active_plots}

## 写作要求
1. 使用第三人称全知视角
2. 对话要生动自然，符合角色性格
3. 动作描写要具体，避免空洞
4. 每段结尾留悬念或推动情节
5. 字数控制在{target_words}字左右

请开始写作：
"""
        return prompt
```

**Expected Deliverable**: 可生成高质量章节内容的系统

#### Step 3.3: 内容审核器
```python
# pseudo-code: src/engine/reviewer.py
class ContentReviewer:
    """内容审核器"""
    
    def __init__(self, llm: OllamaClient):
        self.llm = llm
        self.checks = [
            self._check_consistency,
            self._check_pacing,
            self._check_dialogue,
            self._check_sensitive_content,
            self._check_word_count
        ]
    
    async def review(self, chapter: Chapter, context: WritingContext) -> ReviewResult:
        """审核章节内容"""
        results = []
        
        for check in self.checks:
            result = await check(chapter, context)
            results.append(result)
        
        overall_score = sum(r.score for r in results) / len(results)
        
        return ReviewResult(
            chapter_number=chapter.number,
            checks=results,
            overall_score=overall_score,
            passed=overall_score >= 0.7,
            suggestions=self._aggregate_suggestions(results)
        )
    
    async def _check_consistency(self, chapter: Chapter, 
                                  context: WritingContext) -> CheckResult:
        """一致性检查"""
        prompt = f"""
        请检查以下章节内容是否与前文一致：
        
        前文摘要：{context.recent_summaries}
        
        当前章节：{chapter.content[:1000]}...
        
        检查项目：
        1. 角色名称、性格是否一致
        2. 情节发展是否连贯
        3. 时间线是否正确
        4. 设定是否有冲突
        
        输出格式：
        - 一致性评分：[0-1]
        - 问题列表：[具体问题]
        - 修改建议：[具体建议]
        """
        response = await self.llm.generate(prompt, model="general")
        return self._parse_check_result(response, "consistency")
    
    async def _check_sensitive_content(self, chapter: Chapter, 
                                        context: WritingContext) -> CheckResult:
        """敏感内容检查（番茄小说审核要求）"""
        sensitive_keywords = [
            "政治敏感词", "色情暗示", "暴力过度", "违法内容"
            # 实际应使用完整的敏感词库
        ]
        
        prompt = f"""
        请检查以下内容是否包含不适合网络文学平台的敏感内容：
        
        内容：{chapter.content}
        
        检查项目：
        1. 是否有政治敏感内容
        2. 是否有色情低俗描写
        3. 是否有过度暴力血腥
        4. 是否有违法违规内容
        5. 是否有封建迷信宣扬
        
        输出格式：
        - 安全评分：[0-1]
        - 风险项：[具体风险]
        - 修改建议：[具体建议]
        """
        response = await self.llm.generate(prompt, model="general")
        return self._parse_check_result(response, "sensitive_content")
```

**Expected Deliverable**: 完整的内容审核系统

---

### Phase 4: 发布系统 (Day 8-10)

#### Step 4.1: 番茄小说客户端
```python
# pseudo-code: src/publisher/fanqie_client.py
class FanqieClient:
    """番茄小说发布客户端"""
    
    def __init__(self, config: PublisherConfig):
        self.config = config
        self.browser = None
        self.context = None
        self.page = None
        
    async def login(self, cookie_path: str = None):
        """登录番茄小说作家后台"""
        self.browser = await async_playwright().start()
        self.context = await self.browser.new_context(
            user_agent=self._get_random_ua(),
            viewport={"width": 1920, "height": 1080}
        )
        
        if cookie_path and os.path.exists(cookie_path):
            # 使用保存的 Cookie
            cookies = json.load(open(cookie_path))
            await self.context.add_cookies(cookies)
        
        self.page = await self.context.new_page()
        await self.page.goto("https://fanqienovel.com/writer")
        
        # 检查登录状态
        if not await self._check_login():
            raise LoginRequiredError("需要手动登录")
    
    async def create_novel(self, novel_info: NovelInfo) -> str:
        """创建新小说"""
        await self.page.goto("https://fanqienovel.com/writer/create")
        
        # 填写基本信息
        await self.page.fill('input[name="title"]', novel_info.title)
        await self.page.fill('textarea[name="intro"]', novel_info.intro)
        await self.page.select_option('select[name="category"]', novel_info.category)
        
        # 上传封面（如有）
        if novel_info.cover:
            await self.page.set_input_files('input[type="file"]', novel_info.cover)
        
        # 提交
        await self.page.click('button[type="submit"]')
        
        # 获取小说 ID
        novel_id = await self._extract_novel_id()
        return novel_id
    
    async def publish_chapter(self, novel_id: str, chapter: Chapter) -> bool:
        """发布章节"""
        url = f"https://fanqienovel.com/writer/novel/{novel_id}/chapter/new"
        await self.page.goto(url)
        
        # 填写章节标题
        await self.page.fill('input[name="title"]', chapter.title)
        
        # 填写章节内容（需要处理富文本编辑器）
        await self._fill_content_editor(chapter.content)
        
        # 设置发布时间（可选定时发布）
        if chapter.scheduled_time:
            await self._set_schedule(chapter.scheduled_time)
        
        # 提交审核
        await self.page.click('button:has-text("提交审核")')
        
        # 等待响应
        result = await self._wait_for_result()
        return result.success
    
    async def _fill_content_editor(self, content: str):
        """填写富文本编辑器"""
        # 番茄小说使用特定的编辑器，需要特殊处理
        editor = await self.page.wait_for_selector('.content-editor')
        
        # 分段输入，避免触发反爬
        paragraphs = content.split('\n\n')
        for i, para in enumerate(paragraphs):
            await editor.type(para, delay=50)  # 模拟人工输入速度
            if i < len(paragraphs) - 1:
                await self.page.keyboard.press('Enter')
                await asyncio.sleep(random.uniform(0.5, 1.5))
```

**Expected Deliverable**: 可自动发布到番茄小说的客户端

#### Step 4.2: 反检测模块
```python
# pseudo-code: src/publisher/anti_detect.py
class AntiDetection:
    """反检测模块"""
    
    def __init__(self):
        self.ua_pool = self._load_ua_pool()
        self.proxy_pool = self._load_proxy_pool()
    
    def get_stealth_context_options(self) -> dict:
        """获取隐身上下文选项"""
        return {
            "user_agent": random.choice(self.ua_pool),
            "viewport": {
                "width": random.randint(1200, 1920),
                "height": random.randint(700, 1080)
            },
            "locale": "zh-CN",
            "timezone_id": "Asia/Shanghai",
            "geolocation": {"latitude": 31.2304, "longitude": 121.4737},
            "permissions": ["geolocation"],
            # 隐藏自动化特征
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process"
            ]
        }
    
    async def human_like_delay(self, min_sec: float = 0.5, max_sec: float = 2.0):
        """模拟人类操作延迟"""
        await asyncio.sleep(random.uniform(min_sec, max_sec))
    
    async def random_mouse_movement(self, page):
        """随机鼠标移动"""
        for _ in range(random.randint(2, 5)):
            x = random.randint(100, 1800)
            y = random.randint(100, 900)
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.3))
```

**Expected Deliverable**: 完整的反检测模块

---

### Phase 5: 调度与监控 (Day 11-12)

#### Step 5.1: 定时任务调度
```python
# pseudo-code: src/scheduler/tasks.py
class NovelScheduler:
    """小说自动化调度器"""
    
    def __init__(self, config: SchedulerConfig):
        self.scheduler = AsyncIOScheduler()
        self.config = config
        self.engine = NovelEngine()
        self.publisher = FanqieClient()
    
    def setup_jobs(self):
        """设置定时任务"""
        
        # 每日生成章节（凌晨 2 点）
        self.scheduler.add_job(
            self._daily_chapter_generation,
            trigger=CronTrigger(hour=2, minute=0),
            id="daily_generation",
            replace_existing=True
        )
        
        # 每日发布章节（上午 10 点）
        self.scheduler.add_job(
            self._daily_publishing,
            trigger=CronTrigger(hour=10, minute=0),
            id="daily_publishing",
            replace_existing=True
        )
        
        # 每周检查并更新大纲（周日 0 点）
        self.scheduler.add_job(
            self._weekly_outline_review,
            trigger=CronTrigger(day_of_week="sun", hour=0, minute=0),
            id="weekly_review",
            replace_existing=True
        )
        
        # 健康检查（每小时）
        self.scheduler.add_job(
            self._health_check,
            trigger=CronTrigger(hour="*"),
            id="health_check",
            replace_existing=True
        )
    
    async def _daily_chapter_generation(self):
        """每日章节生成任务"""
        novels = await self._get_active_novels()
        
        for novel in novels:
            try:
                # 生成章节
                chapter = await self.engine.generate_next_chapter(novel.id)
                
                # 审核
                review = await self.engine.review_chapter(chapter)
                
                if review.passed:
                    # 存储待发布
                    await self._queue_for_publishing(novel.id, chapter)
                    await self._notify(f"✅ {novel.title} 第{chapter.number}章 生成完成")
                else:
                    # 需要修改
                    await self._handle_review_failure(novel, chapter, review)
                    
            except Exception as e:
                await self._notify(f"❌ {novel.title} 生成失败: {str(e)}")
                logger.error(f"Chapter generation failed: {e}")
    
    async def _daily_publishing(self):
        """每日发布任务"""
        queue = await self._get_publishing_queue()
        
        for item in queue:
            try:
                success = await self.publisher.publish_chapter(
                    item.novel_id, 
                    item.chapter
                )
                
                if success:
                    await self._mark_as_published(item)
                    await self._notify(f"📤 {item.novel_title} 第{item.chapter.number}章 发布成功")
                else:
                    await self._retry_later(item)
                    
            except Exception as e:
                await self._notify(f"❌ 发布失败: {str(e)}")
                logger.error(f"Publishing failed: {e}")
    
    def start(self):
        """启动调度器"""
        self.scheduler.start()
        logger.info("Novel scheduler started")
```

**Expected Deliverable**: 完整的定时任务系统

#### Step 5.2: 监控与告警
```python
# pseudo-code: src/monitor/monitor.py
class SystemMonitor:
    """系统监控"""
    
    def __init__(self, notification_channels: list):
        self.channels = notification_channels
        self.metrics = MetricsCollector()
    
    async def check_system_health(self) -> HealthStatus:
        """检查系统健康状态"""
        checks = {
            "ollama": await self._check_ollama(),
            "memory": await self._check_memory_usage(),
            "disk": await self._check_disk_space(),
            "network": await self._check_network(),
            "chromadb": await self._check_chromadb()
        }
        
        all_healthy = all(c.status == "healthy" for c in checks.values())
        
        if not all_healthy:
            await self._send_alert(checks)
        
        return HealthStatus(
            status="healthy" if all_healthy else "degraded",
            checks=checks,
            timestamp=datetime.now()
        )
    
    async def _check_ollama(self) -> ComponentStatus:
        """检查 Ollama 服务"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get("http://localhost:11434/api/tags") as resp:
                    if resp.status == 200:
                        return ComponentStatus(status="healthy", message="Ollama running")
        except Exception as e:
            return ComponentStatus(status="unhealthy", message=str(e))
    
    async def _check_memory_usage(self) -> ComponentStatus:
        """检查内存使用（16GB 限制）"""
        import psutil
        memory = psutil.virtual_memory()
        
        if memory.percent > 90:
            return ComponentStatus(
                status="warning", 
                message=f"Memory usage high: {memory.percent}%"
            )
        return ComponentStatus(status="healthy", message=f"Memory: {memory.percent}%")
```

**Expected Deliverable**: 完整的监控系统

---

### Phase 6: Web Dashboard (Day 13-14)

#### Step 6.1: FastAPI 后端
```python
# pseudo-code: src/api/main.py
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Novel Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/novels")
async def list_novels():
    """获取小说列表"""
    pass

@app.get("/api/novels/{novel_id}")
async def get_novel(novel_id: str):
    """获取小说详情"""
    pass

@app.post("/api/novels")
async def create_novel(novel: NovelCreate):
    """创建新小说"""
    pass

@app.get("/api/novels/{novel_id}/chapters")
async def list_chapters(novel_id: str):
    """获取章节列表"""
    pass

@app.post("/api/novels/{novel_id}/generate")
async def trigger_generation(novel_id: str, count: int = 1):
    """手动触发生成"""
    pass

@app.websocket("/ws/logs")
async def logs_websocket(websocket: WebSocket):
    """实时日志推送"""
    await websocket.accept()
    # 实时推送日志
```

**Expected Deliverable**: RESTful API 后端

#### Step 6.2: 前端 Dashboard
```typescript
// pseudo-code: dashboard/src/App.tsx
// 使用 React + Tailwind CSS

interface Novel {
  id: string;
  title: string;
  status: 'drafting' | 'publishing' | 'paused';
  chapterCount: number;
  wordCount: number;
  lastUpdate: Date;
}

function Dashboard() {
  const [novels, setNovels] = useState<Novel[]>([]);
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="container mx-auto p-4">
        <NovelGrid novels={novels} />
        <GenerationQueue />
        <SystemStatus />
        <LogsPanel />
      </main>
    </div>
  );
}
```

**Expected Deliverable**: 可视化管理界面

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `config/settings.yaml` | Create | 全局配置文件 |
| `config/prompts/*.yaml` | Create | Prompt 模板库 |
| `src/llm/ollama_client.py` | Create | Ollama API 封装 |
| `src/memory/chromadb_store.py` | Create | 向量存储 |
| `src/memory/context_builder.py` | Create | 上下文构建器 |
| `src/engine/outline_gen.py` | Create | 大纲生成器 |
| `src/engine/chapter_gen.py` | Create | 章节生成器 |
| `src/engine/reviewer.py` | Create | 内容审核器 |
| `src/publisher/fanqie_client.py` | Create | 番茄小说客户端 |
| `src/publisher/anti_detect.py` | Create | 反检测模块 |
| `src/scheduler/tasks.py` | Create | 定时任务 |
| `src/monitor/monitor.py` | Create | 系统监控 |
| `src/api/main.py` | Create | API 入口 |
| `dashboard/` | Create | 前端项目 |
| `environment.yml` | Create | Conda 环境配置 |

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **16GB 内存不足** | High | High | 使用 7B-12B 模型，关闭不必要进程，优化内存管理 |
| **番茄小说反爬封号** | Medium | Critical | 模拟人工操作，随机延迟，Cookie 轮换，IP 代理 |
| **生成内容质量不稳定** | Medium | Medium | 多轮审核，自动修正，人工审核关键章节 |
| **内容违规被下架** | Low | Critical | 敏感词过滤，内容审核，符合平台规范 |
| **Ollama 服务崩溃** | Medium | High | 自动重启机制，健康检查，告警通知 |
| **故事连贯性丢失** | Medium | Medium | RAG 记忆系统，定期总结，人工干预接口 |
| **平台 API 变更** | Low | High | 模块化设计，快速适配，监控官方更新 |

## Hardware Recommendations (Mac mini M4 16GB)

### 模型配置建议
```
# 推荐配置（~12GB 内存占用）
ollama pull mistral-nemo:12b    # 主力写作模型
ollama pull gemma3:12b-qat      # 备用模型
ollama pull qwen2.5:7b          # 轻量任务

# Ollama 启动参数优化
OLLAMA_ORIGINS="*" ollama serve
```

### 系统优化
```bash
# 关闭不必要的后台应用
# 增加虚拟内存（如需要）
# 设置 Ollama 开机自启
```

## Dependencies

```yaml
# environment.yml
name: novel-automation
channels:
  - conda-forge
  - defaults
dependencies:
  - python=3.11
  - pip
  - pip:
    # LLM
    - ollama>=0.4.0
    
    # Vector DB & Embeddings
    - chromadb>=0.5.0
    - sentence-transformers>=3.0.0
    
    # Web Framework
    - fastapi>=0.115.0
    - uvicorn>=0.30.0
    - websockets>=12.0
    
    # Browser Automation
    - playwright>=1.48.0
    
    # Scheduler
    - apscheduler>=3.10.0
    
    # Utils
    - pyyaml>=6.0
    - pydantic>=2.0
    - httpx>=0.27.0
    - tiktoken>=0.7.0
    - rich>=13.0
    - loguru>=0.7.0
    - psutil>=6.0
```

## Estimated Timeline

| Phase | Duration | Parallelizable |
|-------|----------|----------------|
| Phase 1: 基础设施 | 2 days | No |
| Phase 2: 记忆系统 | 2 days | Yes (with Phase 3) |
| Phase 3: 写作引擎 | 3 days | Yes (with Phase 2) |
| Phase 4: 发布系统 | 3 days | Partial |
| Phase 5: 调度监控 | 2 days | No |
| Phase 6: Dashboard | 2 days | Yes |

**Total: ~14 days** (可并行优化至 ~10 days)

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codeagent-wrapper unavailable)
- GEMINI_SESSION: N/A (codeagent-wrapper unavailable)

---

*Plan generated based on web research for Ollama, ChromaDB, and 番茄小说 automation best practices.*
