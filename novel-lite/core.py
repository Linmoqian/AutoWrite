"""核心逻辑模块"""

import json
import logging
import re
from datetime import datetime
from pathlib import Path

from ai import generate
from config import CONFIG
from files import (
    NOVEL_FILE, OUTLINE_FILE, CONTEXT_FILE, CHAPTERS_DIR,
    read_novel, write_novel, read_outline, write_outline,
    read_context, write_context, read_context_dict,
    get_chapter_outline, parse_outline_text, build_yaml_front_matter, write_file,
)

logger = logging.getLogger(__name__)


def _extract_json(text: str) -> str:
    """从 LLM 回复中提取 JSON，兼容 markdown 代码块。"""
    m = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    candidate = m.group(1).strip() if m else text.strip()
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        return candidate[start : end + 1]
    return candidate


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
            "created": datetime.now().strftime("%Y-%m-%d"),
        }
        write_novel(data)
        write_context({
            "current_chapter": 0,
            "recent_summaries": [],
            "character_states": [],
            "plot_events": [],
            "unresolved_threads": [],
            "emotional_arc": [],
            "tension_checklist": [],
            "current_intent": None,
        })

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
            theme=novel.get("theme", "修仙"),
        )
        world = generate(prompt)
        novel["world"] = world
        write_novel(novel)
        return world

    def _gen_characters(self) -> str:
        """生成角色，返回生成内容，同时更新 novel.md"""
        novel = read_novel()
        prompt = CONFIG["prompts"]["character"].format(
            world=novel.get("world", ""),
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
            total_chapters=novel.get("target_chapters", 100),
        )
        outline_text = generate(prompt)
        write_outline(parse_outline_text(outline_text))
        return outline_text

    def _gen_chapter(self, chapter_num: int) -> str:
        """生成章节（策略C：三层记忆 + 叙事意图头 + 单一焦点提示词）"""
        novel = read_novel()
        chapter_title = get_chapter_outline(chapter_num)
        if not chapter_title:
            raise ValueError(f"未找到第 {chapter_num} 章的大纲")

        prompt = self._build_chapter_prompt(
            chapter_num, chapter_title, novel,
        )
        content = generate(prompt)

        # 写入章节文件
        CHAPTERS_DIR.mkdir(exist_ok=True)
        meta = {
            "chapter": chapter_num,
            "title": chapter_title,
            "words": len(content),
            "created": datetime.now().strftime("%Y-%m-%d"),
        }
        write_file(
            CHAPTERS_DIR / f"{chapter_num:03d}-{chapter_title[:10]}.md",
            build_yaml_front_matter(meta) + f"\n# 第{chapter_num}章 {chapter_title}\n\n{content}",
        )

        # 三次提取 + 更新上下文
        self._update_memory(chapter_num, content)

        return content

    def _build_chapter_prompt(
        self, num: int, title: str, novel: dict,
    ) -> str:
        """构建单一叙事焦点提示词"""
        ctx = read_context_dict()
        genre = novel.get("genre", "玄幻")
        theme = novel.get("theme", "")
        words = novel.get("words_per_chapter", 3000)

        # 叙事意图块
        intent = ctx.get("current_intent")
        if intent:
            intent_block = (
                f"当前核心张力：{intent.get('obstacle', '未知阻碍')}\n"
                f"读者关注点：{intent.get('reader_should_care', '角色命运')}"
            )
        else:
            intent_block = "当前核心张力：主角在故事中面临新的挑战\n读者关注点：主角如何应对"

        # 角色状态
        char_states = ctx.get("character_states", [])
        if char_states and isinstance(char_states[0], dict):
            cs = "\n".join(
                f"- {s.get('name', '?')}：{s.get('location', '?')}，"
                f"{s.get('power_level', '?')}，{s.get('status', '正常')}"
                for s in char_states[-10:]
            )
        elif char_states:
            cs = "\n".join(f"- {s}" for s in char_states[-10:])
        else:
            cs = "- 暂无角色状态"

        # 关键事件
        events = ctx.get("plot_events", [])
        pe = "\n".join(f"- {e}" for e in events[-8:]) if events else "- 暂无"

        # 张力清单
        tension = ctx.get("tension_checklist", [])
        if tension:
            tc = "\n".join(
                f"- [{'x' if t['status'] == 'resolved' else ' '}] {t['item']}"
                for t in tension[-8:]
            )
        else:
            threads = ctx.get("unresolved_threads", [])
            tc = "\n".join(f"- [ ] {t}" for t in threads[-8:]) if threads else "- 暂无"

        # 情感弧线
        arc = ctx.get("emotional_arc", [])
        ea = " → ".join(f"{e['tag']}({e['intensity']})" for e in arc[-6:]) if arc else "暂无"

        return CONFIG["prompts"]["chapter"].format(
            genre=genre, theme=theme,
            intent_block=intent_block,
            character_states=cs,
            plot_events=pe,
            tension_checklist=tc,
            emotional_arc=ea,
            num=num, title=title,
            words=words,
        )

    def _update_memory(self, chapter_num: int, content: str) -> None:
        """三次提取 + 更新三层记忆"""
        ctx = read_context_dict()

        # 提取结构化事实
        facts = self._extract_facts(content)
        if facts:
            self._merge_facts(ctx, facts)

        # 提取叙事意图
        intent = self._extract_intent(content)
        if intent:
            ctx["current_intent"] = intent

        # 提取情感弧线
        emotions = self._extract_emotion(content)
        if emotions:
            arc = ctx.get("emotional_arc", [])
            arc.extend(emotions)
            ctx["emotional_arc"] = arc[-15:]

        # 更新张力清单
        self._update_tension(ctx)

        ctx["current_chapter"] = chapter_num
        write_context(ctx)

    def _extract_facts(self, content: str) -> dict | None:
        """从章节内容中提取结构化事实"""
        try:
            raw = generate(
                CONFIG["prompts"]["extract_facts"].format(content=content[:3000]),
            )
            return json.loads(_extract_json(raw))
        except (json.JSONDecodeError, ValueError, Exception) as e:
            logger.warning(f"事实提取失败: {e}")
            return None

    def _extract_intent(self, content: str) -> dict | None:
        """从章节内容中提取叙事意图"""
        try:
            raw = generate(
                CONFIG["prompts"]["extract_intent"].format(content=content[:3000]),
            )
            return json.loads(_extract_json(raw))
        except (json.JSONDecodeError, ValueError, Exception) as e:
            logger.warning(f"意图提取失败: {e}")
            return None

    def _extract_emotion(self, content: str) -> list[dict]:
        """从章节内容中提取情感弧线"""
        try:
            raw = generate(
                CONFIG["prompts"]["extract_emotion"].format(content=content[:3000]),
            )
            data = json.loads(_extract_json(raw))
            return data.get("tags", [])
        except (json.JSONDecodeError, ValueError, Exception) as e:
            logger.warning(f"情感提取失败: {e}")
            return []

    @staticmethod
    def _merge_facts(ctx: dict, facts: dict) -> None:
        """将提取的事实合并到上下文中"""
        # 合并角色状态
        char_states = ctx.get("character_states", [])
        for ns in facts.get("character_states", []):
            if not isinstance(ns, dict):
                continue
            idx = next(
                (i for i, e in enumerate(char_states)
                 if isinstance(e, dict) and e.get("name") == ns.get("name")),
                None,
            )
            if idx is not None:
                char_states[idx] = ns
            else:
                char_states.append(ns)
        ctx["character_states"] = char_states[-20:]

        # 合并关键事件
        events = ctx.get("plot_events", [])
        events.extend(facts.get("plot_events", []))
        ctx["plot_events"] = events[-20:]

        # 合并未解决悬念
        threads = ctx.get("unresolved_threads", [])
        for t in facts.get("unresolved_threads", []):
            if t not in threads:
                threads.append(t)
        ctx["unresolved_threads"] = threads[-15:]

    @staticmethod
    def _update_tension(ctx: dict) -> None:
        """根据未解决悬念更新张力清单"""
        threads = ctx.get("unresolved_threads", [])
        checklist = ctx.get("tension_checklist", [])
        for t in threads:
            if not any(tc.get("item") == t for tc in checklist):
                checklist.append({"item": t, "status": "open"})
        ctx["tension_checklist"] = checklist[-15:]
