"""小说创作管理器模块"""

import re
import uuid
from typing import List, Optional

from auto_novel.agents.novel_state import Chapter, Character, NovelState
from auto_novel.config import get_llm_client


class NovelManager:
    """小说创作管理器"""

    def __init__(self):
        self.llm_client = get_llm_client()

    def create_novel(self, title: str, genre: str, theme: str) -> NovelState:
        """创建新小说"""
        novel_id = str(uuid.uuid4())[:8]
        return NovelState(
            id=novel_id,
            title=title,
            genre=genre,
            theme=theme,
        )

    def build_world(self, state: NovelState) -> NovelState:
        """构建世界观"""
        prompt = f"""你是一位资深的小说世界观设计师。请为以下小说构建详细的世界观设定。

小说标题：{state.title}
类型：{state.genre}
主题：{state.theme}

请从以下几个方面构建世界观：
1. 时代背景与地理环境
2. 社会结构与政治体系
3. 经济状况与生活方式
4. 文化传统与价值观念
5. 特殊设定（如魔法体系、科技水平等）

请用流畅的文字描述，字数在500-800字之间。"""

        response = self.llm_client.generate(prompt)
        state.world_info = response.strip()
        state.updated_at = __import__("datetime").datetime.now()
        return state

    def create_main_character(
        self,
        state: NovelState,
        character_name: str,
        role: str = "主角",
    ) -> NovelState:
        """创建主角或其他角色"""
        prompt = f"""你是一位专业的小说角色设计师。请为以下小说创建一个角色。

小说标题：{state.title}
类型：{state.genre}
主题：{state.theme}
世界观设定：
{state.world_info}

角色姓名：{character_name}
角色定位：{role}

请详细描述这个角色：
1. 外貌特征与形象气质
2. 性格特点与行为习惯
3. 背景故事与成长经历
4. 核心动机与目标追求

请用生动的文字描述，每个角色描述在300-500字之间。"""

        response = self.llm_client.generate(prompt)
        character = Character(
            name=character_name,
            role=role,
            description=response.strip(),
            background="",
        )
        state.add_character(character)
        return state

    def generate_outline(self, state: NovelState, total_chapters: int) -> NovelState:
        """生成大纲"""
        # 获取主角信息
        main_chars = state.get_main_characters()
        char_info = ""
        for char in main_chars:
            char_info += f"\n角色：{char.name}（{char.role}）\n{char.description}\n"

        prompt = f"""你是一位资深的小说大纲规划师。请为以下小说设计完整的章节大纲。

小说标题：{state.title}
类型：{state.genre}
主题：{state.theme}

世界观设定：
{state.world_info}

主要角色：
{char_info}

请设计 {total_chapters} 章的大纲，每章需要包含：
1. 章节标题（简洁有力，不超过10个字）
2. 章节概要（50-100字）

请按以下格式输出：
第1章：[标题]
概要：[内容]

第2章：[标题]
概要：[内容]

...依此类推"""

        response = self.llm_client.generate(prompt)
        outline = self._parse_outline(response)
        state.outline = outline
        state.total_chapters_planned = total_chapters
        state.updated_at = __import__("datetime").datetime.now()
        return state

    def write_chapter(self, state: NovelState, chapter_num: int) -> NovelState:
        """撰写章节"""
        if chapter_num < 1 or chapter_num > state.total_chapters_planned:
            raise ValueError(f"章节号 {chapter_num} 超出范围")

        # 获取当前章节的大纲信息
        chapter_outline = None
        for item in state.outline:
            if item.get("number") == chapter_num:
                chapter_outline = item
                break

        if not chapter_outline:
            raise ValueError(f"未找到第 {chapter_num} 章的大纲")

        # 获取前几章摘要
        previous_summary = state.get_previous_summary(n=3)

        # 获取主角信息
        main_chars = state.get_main_characters()
        char_info = ""
        for char in main_chars:
            char_info += f"\n{char.name}：{char.description}\n"

        prompt = f"""你是一位专业的网络小说作家。请撰写以下小说的第 {chapter_num} 章。

小说标题：{state.title}
类型：{state.genre}
主题：{state.theme}

章节标题：{chapter_outline.get('title', '')}
章节概要：{chapter_outline.get('summary', '')}

主要角色：
{char_info}

前几章摘要：
{previous_summary if previous_summary else '这是第一章'}

请撰写完整的章节内容，要求：
1. 字数在2000-3000字之间
2. 情节紧凑，有吸引力
3. 对话自然，符合角色性格
4. 注意承上启下的过渡
5. 结尾留有悬念或引出下文

现在请直接输出章节内容（不需要标题）："""

        response = self.llm_client.generate(prompt)
        content = response.strip()
        word_count = len(content.replace("\n", "").replace(" ", ""))

        # 生成章节摘要
        summary_prompt = f"""请为以下章节内容生成一个50-100字的摘要：

{content}

摘要："""
        summary = self.llm_client.generate(summary_prompt).strip()

        chapter = Chapter(
            number=chapter_num,
            title=chapter_outline.get("title", f"第{chapter_num}章"),
            content=content,
            summary=summary,
            word_count=word_count,
        )
        state.add_chapter(chapter)
        return state

    def _parse_outline(self, outline_text: str) -> List[dict]:
        """解析大纲文本"""
        outline = []
        # 匹配章节模式：第X章：标题
        pattern = r"第(\d+)章[：:]\s*(.+?)(?=\n概要|$)"
        summary_pattern = r"概要[：:]\s*(.+?)(?=第\d+章|$)"

        chapters = re.findall(pattern, outline_text, re.DOTALL)
        summaries = re.findall(summary_pattern, outline_text, re.DOTALL)

        for i, (num, title) in enumerate(chapters):
            summary = summaries[i].strip() if i < len(summaries) else ""
            outline.append(
                {
                    "number": int(num),
                    "title": title.strip(),
                    "summary": summary,
                }
            )

        return outline

    def get_novel_stats(self, state: NovelState) -> dict:
        """获取小说统计信息"""
        return {
            "id": state.id,
            "title": state.title,
            "genre": state.genre,
            "theme": state.theme,
            "total_chapters_planned": state.total_chapters_planned,
            "current_chapter": state.current_chapter,
            "progress_percentage": state.get_progress_percentage(),
            "total_words": state.total_words,
            "character_count": len(state.characters),
            "chapter_count": len(state.chapters),
        }
