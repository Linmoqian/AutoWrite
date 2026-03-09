# -*- coding: utf-8 -*-
"""小说创作提示词模板系统"""

from typing import Dict, Any, Optional


class PromptTemplates:
    """小说创作提示词模板类"""

    SYSTEM_NOVEL_WRITER = """你是一位专业的网络文学作家，擅长创作引人入胜的小说。
你的写作风格：
- 情节紧凑，节奏明快
- 人物形象鲜明
- 对话生动自然
- 细节描写到位
- 伏笔和悬念设置巧妙"""

    GENRE_CONFIGS: Dict[str, Dict[str, Any]] = {
        "xuanhuan": {
            "name": "玄幻",
            "elements": ["修炼", "灵气", "境界", "法宝", "宗门"],
            "style": "热血、升级流",
        },
        "dushi": {
            "name": "都市",
            "elements": ["都市生活", "职场", "爱情", "商战"],
            "style": "轻松、爽文",
        },
        "yanqing": {
            "name": "言情",
            "elements": ["爱情", "情感", "缘分", "成长"],
            "style": "甜宠、治愈",
        },
        "kehuan": {
            "name": "科幻",
            "elements": ["未来世界", "科技", "太空", "人工智能"],
            "style": "硬核、想象",
        },
    }

    CHARACTER_TYPES = {
        "protagonist": "主角",
        "antagonist": "反派",
        "supporting": "配角",
        "mentor": "导师",
        "love_interest": "恋人",
    }

    @classmethod
    def get_worldbuilding_prompt(cls, genre: str, theme: str) -> str:
        """
        生成世界观构建提示词

        Args:
            genre: 小说类型代码 (xuanhuan, dushi, yanqing, kehuan)
            theme: 小说主题

        Returns:
            世界观构建提示词
        """
        genre_config = cls.GENRE_CONFIGS.get(genre, cls.GENRE_CONFIGS["xuanhuan"])
        genre_name = genre_config["name"]
        elements = "、".join(genre_config["elements"])
        style = genre_config["style"]

        return f"""请为以下小说构建详细的世界观设定：

小说类型：{genre_name}（风格：{style}）
主题：{theme}

请从以下方面进行世界观构建：

1. **世界背景**
   - 时代背景与社会环境
   - 世界的基本规则和法则
   - 主要势力分布

2. **核心元素设定**
   必须包含以下{genre_name}类型的典型元素：{elements}
   - 请为每个元素设定详细的规则和体系

3. **地理环境**
   - 主要场景和地点
   - 各地点的特色和重要性

4. **力量体系**（如适用）
   - 等级划分
   - 晋升规则
   - 限制与代价

5. **社会结构**
   - 阶层划分
   - 重要组织或势力
   - 社会规则与禁忌

请以JSON格式输出，结构如下：
{{
    "world_name": "世界名称",
    "background": "世界背景描述",
    "elements": {{"元素名": "元素描述"}},
    "locations": [{{"name": "地点名", "description": "描述"}}],
    "power_system": {{"levels": [], "rules": ""}},
    "social_structure": {{"classes": [], "organizations": []}}
}}"""

    @classmethod
    def get_character_prompt(
        cls, character_type: str, world_info: Dict[str, Any]
    ) -> str:
        """
        生成角色设计提示词

        Args:
            character_type: 角色类型 (protagonist, antagonist, supporting, mentor, love_interest)
            world_info: 世界观信息

        Returns:
            角色设计提示词
        """
        type_name = cls.CHARACTER_TYPES.get(character_type, "配角")
        world_name = world_info.get("world_name", "未知世界")
        background = world_info.get("background", "")

        return f"""请设计一个{type_name}角色：

世界观背景：
- 世界名称：{world_name}
- 世界简介：{background}

请从以下方面设计角色：

1. **基本信息**
   - 姓名（符合世界观风格）
   - 年龄
   - 性别
   - 身份/职业

2. **外貌特征**
   - 整体形象
   - 显著特点
   - 常见装扮

3. **性格特点**
   - 主要性格特征（至少3个）
   - 行为习惯
   - 说话方式

4. **背景故事**
   - 出身背景
   - 重要经历
   - 核心动机

5. **能力设定**（如适用）
   - 主要能力
   - 强项与弱点
   - 成长空间

6. **人际关系**
   - 重要关系人
   - 关系性质

请以JSON格式输出，结构如下：
{{
    "name": "角色名",
    "age": "年龄",
    "gender": "性别",
    "identity": "身份",
    "appearance": {{"整体描述": "", "特点": [], "装扮": ""}},
    "personality": {{"特征": [], "习惯": "", "说话方式": ""}},
    "background": {{"出身": "", "经历": [], "动机": ""}},
    "abilities": {{"主要能力": [], "强项": [], "弱点": []}},
    "relationships": [{{"角色": "", "关系": ""}}]
}}"""

    @classmethod
    def get_outline_prompt(
        cls,
        genre: str,
        world_info: Dict[str, Any],
        main_character: Dict[str, Any],
        total_chapters: int,
    ) -> str:
        """
        生成大纲生成提示词

        Args:
            genre: 小说类型代码
            world_info: 世界观信息
            main_character: 主角信息
            total_chapters: 总章节数

        Returns:
            大纲生成提示词
        """
        genre_config = cls.GENRE_CONFIGS.get(genre, cls.GENRE_CONFIGS["xuanhuan"])
        genre_name = genre_config["name"]
        style = genre_config["style"]
        world_name = world_info.get("world_name", "未知世界")
        character_name = main_character.get("name", "主角")
        character_identity = main_character.get("identity", "未知身份")
        character_motivation = main_character.get("background", {}).get("动机", "")

        return f"""请为以下小说创作详细的大纲：

小说类型：{genre_name}（风格：{style}）
总章节数：{total_chapters}章

世界观：
- 世界名称：{world_name}
- 世界背景：{world_info.get('background', '暂无')}

主角设定：
- 姓名：{character_name}
- 身份：{character_identity}
- 核心动机：{character_motivation}

请按照以下结构创作大纲：

1. **故事主线**
   - 核心冲突
   - 故事主题
   - 情感基调

2. **剧情结构**（按三幕式或网文节奏）
   - 开篇（第1-{total_chapters // 4}章）：设定与冲突引入
   - 发展（第{total_chapters // 4 + 1}-{total_chapters * 3 // 4}章）：冲突升级与转折
   - 高潮与结局（第{total_chapters * 3 // 4 + 1}-{total_chapters}章）：最终对决与收尾

3. **分章大纲**
   请为每一章提供：
   - 章节标题
   - 主要情节（50-100字）
   - 出场人物
   - 关键事件

请以JSON格式输出，结构如下：
{{
    "main_plot": {{"核心冲突": "", "主题": "", "基调": ""}},
    "structure": {{
        "开篇": {{"范围": "第X-Y章", "内容": ""}},
        "发展": {{"范围": "第X-Y章", "内容": ""}},
        "高潮": {{"范围": "第X-Y章", "内容": ""}}
    }},
    "chapters": [
        {{
            "chapter": 1,
            "title": "章节标题",
            "summary": "主要情节",
            "characters": ["出场人物"],
            "key_events": ["关键事件"]
        }}
    ]
}}"""

    @classmethod
    def get_chapter_prompt(
        cls,
        chapter_num: int,
        title: str,
        outline: Dict[str, Any],
        previous_summary: Optional[str],
        world_info: Dict[str, Any],
        characters: Dict[str, Dict[str, Any]],
    ) -> str:
        """
        生成章节生成提示词

        Args:
            chapter_num: 章节号
            title: 章节标题
            outline: 大纲信息
            previous_summary: 上一章摘要
            world_info: 世界观信息
            characters: 角色信息字典

        Returns:
            章节生成提示词
        """
        # 获取当前章节的大纲信息
        chapters = outline.get("chapters", [])
        current_chapter_outline = None
        for ch in chapters:
            if ch.get("chapter") == chapter_num:
                current_chapter_outline = ch
                break

        chapter_summary = (
            current_chapter_outline.get("summary", "") if current_chapter_outline else ""
        )
        key_events = (
            current_chapter_outline.get("key_events", [])
            if current_chapter_outline
            else []
        )
        chapter_characters = (
            current_chapter_outline.get("characters", [])
            if current_chapter_outline
            else []
        )

        # 构建角色信息
        characters_info = ""
        for char_name in chapter_characters:
            if char_name in characters:
                char = characters[char_name]
                characters_info += f"\n- {char_name}：{char.get('identity', '')}，{char.get('personality', {}).get('特征', [''])[0] if char.get('personality', {}).get('特征') else ''}"

        previous_context = (
            f"\n上一章摘要：\n{previous_summary}\n"
            if previous_summary
            else "\n这是第一章，无需参考前文。\n"
        )

        return f"""请创作小说的第{chapter_num}章：

章节信息：
- 章节号：第{chapter_num}章
- 章节标题：{title}
- 本章大纲：{chapter_summary}
- 关键事件：{', '.join(key_events) if key_events else '按大纲创作'}

世界观背景：
- 世界名称：{world_info.get('world_name', '未知世界')}
- 世界背景：{world_info.get('background', '')[:200]}...

本章出场角色：{characters_info if characters_info else '按大纲设定'}
{previous_context}
写作要求：
1. 字数：2000-4000字
2. 风格：{outline.get('main_plot', {}).get('基调', '引人入胜')}
3. 必须包含的关键事件：{', '.join(key_events) if key_events else '按大纲创作'}
4. 注意与前后章节的衔接
5. 场景描写要具体，对话要生动
6. 适当设置悬念和伏笔

请直接输出章节正文内容，不需要输出JSON格式。"""

    @classmethod
    def get_summary_prompt(cls, chapter_content: str) -> str:
        """
        生成摘要生成提示词

        Args:
            chapter_content: 章节内容

        Returns:
            摘要生成提示词
        """
        # 截取内容前2000字以避免过长
        content_preview = (
            chapter_content[:2000] + "..."
            if len(chapter_content) > 2000
            else chapter_content
        )

        return f"""请为以下章节内容生成摘要：

章节内容：
{content_preview}

请生成以下信息：

1. **章节摘要**（100-200字）
   - 概括本章主要情节
   - 突出关键事件和转折点

2. **出场人物**
   - 列出本章出现的所有重要角色

3. **关键信息**
   - 重要的伏笔或线索
   - 角色关系变化
   - 剧情推进要点

请以JSON格式输出：
{{
    "summary": "章节摘要内容",
    "characters": ["出场人物列表"],
    "key_points": ["关键信息列表"]
}}"""

    @classmethod
    def get_all_genres(cls) -> Dict[str, str]:
        """
        获取所有支持的类型

        Returns:
            类型代码到类型名称的映射
        """
        return {code: config["name"] for code, config in cls.GENRE_CONFIGS.items()}

    @classmethod
    def get_genre_elements(cls, genre: str) -> list:
        """
        获取指定类型的元素列表

        Args:
            genre: 小说类型代码

        Returns:
            元素列表
        """
        genre_config = cls.GENRE_CONFIGS.get(genre)
        return genre_config["elements"] if genre_config else []
