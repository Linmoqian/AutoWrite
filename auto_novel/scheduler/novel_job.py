"""小说创作任务"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

from ..agents.novel_manager import NovelManager
from ..agents.novel_state import NovelState
from ..publisher.fanqie_publisher import FanqiePublisher

logger = logging.getLogger(__name__)


class NovelJob:
    """小说创作任务

    封装单本小说的完整创作流程：
    1. 初始化 (世界观、角色、大纲)
    2. 撰写章节
    3. 发布到平台
    4. 保存状态
    """

    def __init__(
        self,
        novel_state: NovelState,
        book_id: Optional[str] = None,
        auto_publish: bool = True
    ):
        """初始化小说任务

        Args:
            novel_state: 小说状态对象
            book_id: 番茄小说书籍ID (可选)
            auto_publish: 是否自动发布
        """
        self.state = novel_state
        self.book_id = book_id
        self.auto_publish = auto_publish
        self.manager = NovelManager()
        self.publisher: Optional[FanqiePublisher] = None

        if auto_publish:
            self.publisher = FanqiePublisher(headless=True)

    async def initialize(self):
        """初始化任务

        如果小说还未初始化，会自动：
        1. 构建世界观
        2. 创建主角
        3. 生成大纲
        4. 启动发布器 (如果启用自动发布)
        """
        if not self.state.world_info:
            logger.info(f"[{self.state.title}] 开始构建世界观...")
            await self.manager.build_world(self.state)
            logger.info(f"[{self.state.title}] 世界观构建完成")

        if not self.state.characters:
            logger.info(f"[{self.state.title}] 创建主角...")
            await self.manager.create_main_character(self.state)
            logger.info(f"[{self.state.title}] 主角创建完成")

        if not self.state.outline:
            logger.info(f"[{self.state.title}] 生成大纲...")
            await self.manager.generate_outline(self.state)
            logger.info(f"[{self.state.title}] 大纲生成完成，共 {len(self.state.outline)} 章")

        if self.auto_publish and self.publisher:
            await self.publisher.start()
            logger.info(f"[{self.state.title}] 发布器已启动")

    async def write_next_chapter(self) -> dict:
        """撰写下一章

        Returns:
            包含章节信息的字典:
            - chapter: 章节号
            - title: 章节标题
            - word_count: 字数
            - published: 是否已发布
        """
        next_chapter = self.state.current_chapter + 1
        logger.info(f"[{self.state.title}] 开始撰写第 {next_chapter} 章...")

        # 撰写章节
        chapter = await self.manager.write_chapter(self.state, next_chapter)

        result = {
            "chapter": next_chapter,
            "title": chapter.title,
            "word_count": chapter.word_count,
            "published": False
        }

        # 自动发布
        if self.auto_publish and self.book_id and self.publisher:
            logger.info(f"[{self.state.title}] 发布第 {next_chapter} 章到番茄小说...")
            try:
                success = await self.publisher.publish_chapter(self.book_id, chapter)
                result["published"] = success
                if success:
                    logger.info(f"[{self.state.title}] 第 {next_chapter} 章发布成功!")
                else:
                    logger.error(f"[{self.state.title}] 第 {next_chapter} 章发布失败!")
            except Exception as e:
                logger.error(f"[{self.state.title}] 发布异常: {e}")
                result["published"] = False

        # 保存状态
        await self._save_state()

        logger.info(
            f"[{self.state.title}] 第 {next_chapter} 章完成 "
            f"(字数: {chapter.word_count}, 发布: {result['published']})"
        )

        return result

    async def write_multiple_chapters(self, count: int = 1) -> list:
        """撰写多章

        Args:
            count: 要撰写的章节数

        Returns:
            章节结果列表
        """
        results = []
        for _ in range(count):
            result = await self.write_next_chapter()
            results.append(result)
            # 章节之间短暂休息
            await asyncio.sleep(2)
        return results

    async def _save_state(self):
        """保存小说状态到文件"""
        save_dir = Path("data/novels") / self.state.id
        save_dir.mkdir(parents=True, exist_ok=True)

        state_file = save_dir / "state.json"

        # 转换为可序列化格式
        data = {
            "id": self.state.id,
            "title": self.state.title,
            "genre": self.state.genre,
            "theme": self.state.theme,
            "world_info": self.state.world_info,
            "current_chapter": self.state.current_chapter,
            "total_words": self.state.total_words,
            "total_chapters_planned": self.state.total_chapters_planned,
            "characters": [
                {
                    "name": c.name,
                    "role": c.role,
                    "description": c.description,
                    "background": c.background
                }
                for c in self.state.characters
            ],
            "outline": self.state.outline,
            "chapters": [
                {
                    "number": ch.number,
                    "title": ch.title,
                    "content": ch.content,
                    "summary": ch.summary,
                    "word_count": ch.word_count,
                    "published": ch.published
                }
                for ch in self.state.chapters
            ]
        }

        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.debug(f"[{self.state.title}] 状态已保存到 {state_file}")

    @classmethod
    def load_state(cls, novel_id: str) -> Optional[NovelState]:
        """从文件加载小说状态

        Args:
            novel_id: 小说ID

        Returns:
            小说状态对象，如果不存在则返回 None
        """
        from ..agents.novel_state import Chapter, Character

        state_file = Path(f"data/novels/{novel_id}/state.json")
        if not state_file.exists():
            return None

        with open(state_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 重建状态对象
        state = NovelState(
            id=data["id"],
            title=data["title"],
            genre=data["genre"],
            theme=data["theme"],
            world_info=data.get("world_info", ""),
            current_chapter=data.get("current_chapter", 0),
            total_words=data.get("total_words", 0),
            total_chapters_planned=data.get("total_chapters_planned", 100)
        )

        # 重建角色
        for c in data.get("characters", []):
            state.characters.append(Character(
                name=c["name"],
                role=c["role"],
                description=c["description"],
                background=c.get("background", "")
            ))

        # 重建大纲
        state.outline = data.get("outline", [])

        # 重建章节
        for ch in data.get("chapters", []):
            state.chapters.append(Chapter(
                number=ch["number"],
                title=ch["title"],
                content=ch["content"],
                summary=ch["summary"],
                word_count=ch["word_count"],
                published=ch.get("published", False)
            ))

        return state

    async def cleanup(self):
        """清理资源"""
        if self.publisher:
            await self.publisher.close()
            logger.info(f"[{self.state.title}] 发布器已关闭")
