"""核心逻辑模块"""

from datetime import datetime
from pathlib import Path

from ai import generate
from config import CONFIG
from files import (
    NOVEL_FILE, OUTLINE_FILE, CONTEXT_FILE, CHAPTERS_DIR,
    read_novel, write_novel, read_outline, write_outline,
    read_context, write_context, read_context_dict,
    get_chapter_outline, parse_outline_text, build_yaml_front_matter, write_file
)


class Novel:
    """小说创作管理类"""

    def __init__(self, path: Path = None):
        """初始化，path 为小说目录，默认当前目录"""
        self.path = path or Path.cwd()

    def create(self, title: str, genre: str = "xuanhuan",
               theme: str = "修仙", chapters: int = 100) -> None:
        """创建新小说，生成 novel.md 和 context.md"""
        data = {
            "title": title,
            "genre": genre,
            "theme": theme,
            "target_chapters": chapters,
            "words_per_chapter": 3000,
            "model": CONFIG["model"],
            "created": datetime.now().strftime("%Y-%m-%d")
        }
        write_novel(data)
        write_context({"current_chapter": 0, "recent_summaries": []})

    def generate_outline(self) -> None:
        """生成完整大纲，依次执行：世界观 → 角色 → 章节列表"""
        self._gen_world()
        self._gen_characters()
        self._gen_outline()

    def write_chapter(self) -> int:
        """撰写下一章，自动获取当前进度+1，返回章节号"""
        chapter_num = self._get_next_chapter_num()
        self._gen_chapter(chapter_num)
        return chapter_num

    def _get_next_chapter_num(self) -> int:
        """获取下一章章节号"""
        ctx = read_context_dict()
        return ctx.get("current_chapter", 0) + 1

    def _gen_world(self) -> str:
        """生成世界观，返回生成内容，同时更新 novel.md"""
        novel = read_novel()
        prompt = CONFIG["prompts"]["world"].format(
            genre=novel.get("genre", "玄幻"),
            theme=novel.get("theme", "修仙")
        )
        world = generate(prompt)
        novel["world"] = world
        write_novel(novel)
        return world

    def _gen_characters(self) -> str:
        """生成角色，返回生成内容，同时更新 novel.md"""
        novel = read_novel()
        prompt = CONFIG["prompts"]["character"].format(
            world=novel.get("world", "")
        )
        characters = generate(prompt)
        novel["characters"] = characters
        write_novel(novel)
        return characters

    def _gen_outline(self) -> str:
        """生成章节大纲，写入 outline.md"""
        novel = read_novel()
        prompt = CONFIG["prompts"]["outline"].format(
            world=novel.get("world", ""),
            characters=novel.get("characters", ""),
            total_chapters=novel.get("target_chapters", 100)
        )
        outline_text = generate(prompt)
        write_outline(parse_outline_text(outline_text))
        return outline_text

    def _gen_chapter(self, chapter_num: int) -> str:
        """生成章节"""
        novel = read_novel()
        chapter_title = get_chapter_outline(chapter_num)
        if not chapter_title:
            raise ValueError(f"未找到第 {chapter_num} 章的大纲")

        prompt = CONFIG["prompts"]["chapter"].format(
            context=read_context(),
            num=chapter_num,
            title=chapter_title,
            outline_detail=f"第{chapter_num}章：{chapter_title}",
            words=novel.get("words_per_chapter", 3000),
            style=f"{novel.get('genre', '玄幻')}类型，{novel.get('theme', '')}主题"
        )
        content = generate(prompt)

        # 写入章节文件
        CHAPTERS_DIR.mkdir(exist_ok=True)
        meta = {
            "chapter": chapter_num,
            "title": chapter_title,
            "words": len(content),
            "created": datetime.now().strftime("%Y-%m-%d")
        }
        write_file(
            CHAPTERS_DIR / f"{chapter_num:03d}-{chapter_title[:10]}.md",
            build_yaml_front_matter(meta) + f"\n# 第{chapter_num}章 {chapter_title}\n\n{content}"
        )

        # 更新上下文
        ctx = read_context_dict()
        try:
            summary = generate(f"请用200字概括以下章节的剧情：\n{content[:2000]}")
        except Exception:
            summary = content[:200]
        ctx["recent_summaries"] = (ctx.get("recent_summaries", []) + [f"第{chapter_num}章：{summary}"])[-5:]
        ctx["current_chapter"] = chapter_num
        write_context(ctx)

        return content
