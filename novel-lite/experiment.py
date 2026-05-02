"""对照实验：提示词工程与记忆策略对比

三种策略：
  A — 滚动摘要基线（复刻当前 novel-lite 逻辑）
  B — 结构化事实提取
  C — 三层记忆 + 叙事意图头 + 单一焦点提示词

用法:
  set DEEPSEEK_API_KEY=sk-xxx
  pip install openai pyyaml
  python experiment.py
"""

import argparse
import json
import logging
import os
import re
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from openai import OpenAI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── 固定小说设定 ──────────────────────────────────────────────

NOVEL_SETUP: dict[str, Any] = {
    "title": "逆天剑尊",
    "genre": "玄幻",
    "theme": "逆天改命，一剑破万法",
    "words_per_chapter": 3000,
    "world": (
        "九天大陆，以剑道为尊。大陆分为五大域：东域灵山、西域荒漠、南域火海、北域冰原、中域天柱。"
        "修炼体系共九阶：剑徒→剑士→剑师→大剑师→剑宗→剑王→剑皇→剑帝→剑圣。"
        "每阶分初期、中期、后期三小境。突破剑宗需领悟剑意，突破剑帝需凝聚剑域。"
        "大陆最高权力机构为天道盟，统辖各域宗门。禁忌之地'深渊裂隙'中封印着上古魔族。"
        "每隔千年，裂隙松动，魔族入侵，称为'天劫'。上一次天劫已过九百年。"
        "各宗门暗中争夺'法则碎片'——天劫中散落的大道本源，可助突破剑圣以上境界。"
    ),
    "characters": (
        "【主角】林凡，十六岁少年，东域灵山脚下林家村人。"
        "天赋觉醒'逆命之血'——可在绝境中短暂越级战斗，但每次使用都会折损寿命。"
        "性格：表面懒散随和，内心坚韧执着，重情义。目标：找到失踪的父亲林天行。"
        "【女主】苏璃，天道盟盟主之女，剑宗中期。外表冷若冰霜，内心善良。"
        "隐藏身份为上古剑圣转世。与林凡有宿命纠葛。"
        "【反派】墨渊，天道盟暗部首领，剑皇后期。表面维护正义，暗中收集法则碎片企图打开深渊裂隙。"
        "真实身份为上一次天劫中魔族安插的人族内应。"
        "【师父】云苍，星轨殿长老，剑帝初期。隐居多年，是林凡父亲林天行的故交。"
        "因一次失败的实验失去了右臂，以剑气凝成义肢。"
    ),
    "outline": [
        {"num": 1, "title": "穿越异界"},
        {"num": 2, "title": "浮空岛少年"},
        {"num": 3, "title": "逆命之血觉醒"},
        {"num": 4, "title": "天道盟来人"},
        {"num": 5, "title": "初试剑意"},
        {"num": 6, "title": "命格测试"},
        {"num": 7, "title": "遭遇暗杀"},
        {"num": 8, "title": "苏璃相救"},
        {"num": 9, "title": "星轨殿求学"},
        {"num": 10, "title": "法则碎片初现"},
    ],
}

# ── 提示词模板 ────────────────────────────────────────────────

# 历史章节生成（中立方法，所有策略共用）
HISTORY_CHAPTER_PROMPT = """\
{context}
## 本章任务
第{num}章：{title}
## 大纲描述
第{num}章：{title}
## 要求
- 字数：{words}字
- 风格：{genre}类型，{theme}主题
- 场景描写细腻，对话生动
- 章末留悬念或转折
直接输出章节正文内容。"""

HISTORY_SUMMARY_PROMPT = "请用200字概括以下章节的剧情：\n{content}"

# 策略 A 章节提示词（与 config.yaml chapter 模板一致）
STRATEGY_A_CHAPTER_PROMPT = """\
{context}
## 本章任务
第{num}章：{title}
## 大纲描述
第{num}章：{title}
## 要求
- 字数：{words}字
- 风格：{genre}类型，{theme}主题
- 场景描写细腻，对话生动
- 章末留悬念或转折
直接输出章节正文内容。"""

# 策略 B 提取提示词
STRATEGY_B_EXTRACT_PROMPT = """\
请从以下章节内容中提取结构化信息，严格按JSON格式输出：

{{
  "character_states": [
    {{"name": "角色名", "location": "当前位置", "power_level": "当前实力", "recent_action": "最近行动", "status": "状态"}}
  ],
  "plot_events": ["关键事件1", "关键事件2", "关键事件3"],
  "unresolved_threads": ["未解决的悬念1", "未解决的悬念2"]
}}

要求：
- character_states 包含本章出现的所有重要角色
- plot_events 只记录推动剧情的关键事件，最多5个
- unresolved_threads 记录本章新增或延续的未解决线索

章节内容：
{content}"""

# 策略 B 章节提示词
STRATEGY_B_CHAPTER_PROMPT = """\
## 当前剧情状态

### 角色状态
{character_states}

### 已发生的关键事件（最近10条）
{plot_events}

### 未解决的悬念
{unresolved_threads}

## 本章任务
第{num}章：{title}

## 要求
- 字数：{words}字
- 风格：{genre}类型，{theme}主题
- 场景描写细腻，对话生动
- 章末留悬念或转折
直接输出章节正文内容。"""

# 策略 C 意图提取提示词
STRATEGY_C_INTENT_PROMPT = """\
请阅读以下章节内容，用简洁的语言回答三个问题：

1. 角色想要什么？（一句话）
2. 什么阻碍了他？（一句话）
3. 读者该在意什么？（一句话）

请严格按以下JSON格式输出：
{{"character_wants": "...", "obstacle": "...", "reader_should_care": "..."}}

章节内容：
{content}"""

# 策略 C 情感提取提示词
STRATEGY_C_EMOTION_PROMPT = """\
请为以下章节的情感走向打标签。输出JSON：
{{"tags": [{{"tag": "情感标签", "intensity": 1}}]}}

可选标签：紧张、愤怒、悲伤、温馨、热血、恐惧、希望、绝望、迷茫、震撼
intensity范围1-5，每章最多3个标签。

章节内容：
{content}"""

# 策略 C 章节提示词（单一叙事焦点）
STRATEGY_C_CHAPTER_PROMPT = """\
你是一位资深小说作家，正在创作一部{genre}类型小说，主题为{theme}。

## 叙事核心
{intent_block}

## 事实基础
### 角色当前位置与状态
{character_states}

### 已发生的关键事件
{plot_events}

### 尚未解决的悬念
{tension_checklist}

### 情感走向
最近几章的情感轨迹：{emotional_arc}

## 本章写作任务
第{num}章：{title}

写作要求：围绕核心叙事张力展开，用场景和对话推进剧情，
自然处理至少一个未解决的悬念。字数约{words}字。
直接输出章节正文内容。"""


# ── API 客户端 ────────────────────────────────────────────────

@dataclass
class TokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class GenResult:
    content: str
    prompt_sent: str
    usage: TokenUsage
    timestamp: str = ""
    model: str = ""


class DeepSeekClient:
    """DeepSeek API 封装，兼容现有 generate() 模式。"""

    def __init__(self) -> None:
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            raise RuntimeError("DEEPSEEK_API_KEY 环境变量未设置")
        self.client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        self.model = "deepseek-chat"
        self.temperature = 0.7
        self.usage_log: list[dict[str, Any]] = []

    def generate(self, prompt: str, retries: int = 3) -> GenResult:
        for attempt in range(retries):
            try:
                resp = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self.temperature,
                )
                usage = TokenUsage(
                    prompt_tokens=resp.usage.prompt_tokens,
                    completion_tokens=resp.usage.completion_tokens,
                    total_tokens=resp.usage.total_tokens,
                )
                self.usage_log.append(asdict(usage))
                return GenResult(
                    content=resp.choices[0].message.content,
                    prompt_sent=prompt,
                    usage=usage,
                    timestamp=datetime.now().isoformat(),
                    model=self.model,
                )
            except Exception as e:
                if attempt == retries - 1:
                    raise RuntimeError(f"API 调用失败（重试 {retries} 次）: {e}") from e
                wait = 2 ** attempt
                logger.warning(f"API 调用失败，{wait}s 后重试: {e}")
                time.sleep(wait)
        raise RuntimeError("unreachable")

    def cumulative_tokens(self) -> dict[str, int]:
        total_p = sum(u["prompt_tokens"] for u in self.usage_log)
        total_c = sum(u["completion_tokens"] for u in self.usage_log)
        return {"prompt_tokens": total_p, "completion_tokens": total_c, "total_tokens": total_p + total_c}


# ── JSON 提取工具 ─────────────────────────────────────────────

def extract_json(text: str) -> str:
    """从 LLM 回复中提取 JSON，兼容 markdown 代码块包裹。"""
    m = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    candidate = m.group(1).strip() if m else text.strip()
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        return candidate[start : end + 1]
    return candidate


# ── 策略 A：滚动摘要基线 ─────────────────────────────────────

class StrategyA:
    """复刻 novel-lite 当前逻辑：5 章滚动窗口 + 200 字叙述摘要。"""

    name = "A_rolling_summary"
    description = "5章滚动摘要+200字叙述概括（当前系统基线）"

    def __init__(self, client: DeepSeekClient) -> None:
        self.client = client
        self.summaries: list[str] = []
        self.chapter_count = 0

    def init_from_history(self, chapters: list[dict[str, Any]]) -> None:
        for ch in chapters:
            self.summaries.append(ch["summary_text"])
        self.summaries = self.summaries[-5:]
        self.chapter_count = chapters[-1]["num"] if chapters else 0

    def build_prompt(self, num: int, title: str) -> str:
        ctx = self._context_text()
        return STRATEGY_A_CHAPTER_PROMPT.format(
            context=ctx, num=num, title=title,
            words=NOVEL_SETUP["words_per_chapter"],
            genre=NOVEL_SETUP["genre"], theme=NOVEL_SETUP["theme"],
        )

    def update_memory(self, num: int, title: str, content: str) -> str:
        result = self.client.generate(
            HISTORY_SUMMARY_PROMPT.format(content=content[:2000])
        )
        self.summaries.append(f"第{num}章：{result.content.strip()}")
        self.summaries = self.summaries[-5:]
        self.chapter_count = num
        return result.content.strip()

    def context_snapshot(self) -> str:
        return self._context_text()

    def _context_text(self) -> str:
        parts = [f"# 上下文摘要\n\n## 当前进度\n- 已完成：{self.chapter_count}章\n"]
        if self.summaries:
            parts.append("## 剧情摘要（最近5章）\n" + "\n".join(self.summaries[-5:]) + "\n")
        return "\n".join(parts)


# ── 策略 B：结构化事实提取 ────────────────────────────────────

class StrategyB:
    """用结构化 JSON schema 替代叙述摘要。"""

    name = "B_structured_facts"
    description = "结构化schema提取（角色状态/事件/悬念）"

    def __init__(self, client: DeepSeekClient) -> None:
        self.client = client
        self.character_states: list[dict[str, str]] = []
        self.plot_events: list[str] = []
        self.unresolved_threads: list[str] = []
        self.chapter_count = 0

    def init_from_history(self, chapters: list[dict[str, Any]]) -> None:
        for ch in chapters:
            self._extract(ch["content"])
            self.chapter_count = ch["num"]

    def build_prompt(self, num: int, title: str) -> str:
        cs = "\n".join(
            f"- {s['name']}：{s.get('location', '未知')}，{s.get('power_level', '未知')}，{s.get('recent_action', '无')}"
            for s in self.character_states
        ) or "- 暂无角色状态记录"
        pe = "\n".join(f"{i+1}. {e}" for i, e in enumerate(self.plot_events[-10:])) or "- 暂无事件记录"
        ut = "\n".join(f"- [ ] {t}" for t in self.unresolved_threads[-10:]) or "- 暂无未解决悬念"

        return STRATEGY_B_CHAPTER_PROMPT.format(
            character_states=cs, plot_events=pe, unresolved_threads=ut,
            num=num, title=title,
            words=NOVEL_SETUP["words_per_chapter"],
            genre=NOVEL_SETUP["genre"], theme=NOVEL_SETUP["theme"],
        )

    def update_memory(self, num: int, title: str, content: str) -> dict:
        self._extract(content)
        self.chapter_count = num
        return {
            "character_states": self.character_states,
            "plot_events": self.plot_events[-10:],
            "unresolved_threads": self.unresolved_threads[-10:],
        }

    def context_snapshot(self) -> str:
        lines = ["# 结构化上下文\n"]
        lines.append("## 角色状态")
        for s in self.character_states:
            lines.append(f"- {json.dumps(s, ensure_ascii=False)}")
        lines.append("\n## 关键事件")
        for e in self.plot_events[-10:]:
            lines.append(f"- {e}")
        lines.append("\n## 未解决悬念")
        for t in self.unresolved_threads[-10:]:
            lines.append(f"- {t}")
        return "\n".join(lines)

    def _extract(self, content: str) -> None:
        result = self.client.generate(
            STRATEGY_B_EXTRACT_PROMPT.format(content=content[:3000])
        )
        try:
            data = json.loads(extract_json(result.content))
        except (json.JSONDecodeError, ValueError):
            logger.warning("策略B：JSON 提取失败，跳过")
            return
        for ns in data.get("character_states", []):
            idx = next(
                (i for i, e in enumerate(self.character_states) if e.get("name") == ns.get("name")),
                None,
            )
            if idx is not None:
                self.character_states[idx] = ns
            else:
                self.character_states.append(ns)
        self.plot_events.extend(data.get("plot_events", []))
        self.plot_events = self.plot_events[-20:]
        for t in data.get("unresolved_threads", []):
            if t not in self.unresolved_threads:
                self.unresolved_threads.append(t)
        self.unresolved_threads = self.unresolved_threads[-15:]


# ── 策略 C：三层记忆 + 叙事意图头 ─────────────────────────────

class StrategyC:
    """结构化事实 + 情感弧线 + 张力清单 + 叙事意图头 + 单一焦点提示词。"""

    name = "C_intent_driven"
    description = "三层记忆（事实+情感+张力）+ 叙事意图头 + 单一叙事焦点提示词"

    def __init__(self, client: DeepSeekClient) -> None:
        self.client = client
        # 层1：硬事实
        self.character_states: list[dict[str, str]] = []
        self.plot_events: list[str] = []
        self.unresolved_threads: list[str] = []
        # 层2：情感弧线
        self.emotional_arc: list[dict[str, Any]] = []
        # 层3：张力清单
        self.tension_checklist: list[dict[str, str]] = []
        # 叙事意图
        self.current_intent: dict[str, str] | None = None
        self.chapter_count = 0

    def init_from_history(self, chapters: list[dict[str, Any]]) -> None:
        for ch in chapters:
            self._extract_all(ch["content"])
            self.chapter_count = ch["num"]

    def build_prompt(self, num: int, title: str) -> str:
        # 叙事意图块
        if self.current_intent:
            intent_block = (
                f"当前核心张力：{self.current_intent.get('obstacle', '未知阻碍')}\n"
                f"读者关注点：{self.current_intent.get('reader_should_care', '角色命运')}"
            )
            focus = self.current_intent.get("character_wants", "推进剧情")
        else:
            intent_block = "当前核心张力：主角在陌生世界中摸索前行\n读者关注点：主角如何立足"
            focus = "在新世界中建立立足之地"

        cs = "\n".join(
            f"- {s['name']}：{s.get('location', '未知')}，{s.get('power_level', '未知')}，{s.get('status', '正常')}"
            for s in self.character_states
        ) or "- 暂无"

        pe = "\n".join(f"- {e}" for e in self.plot_events[-8:]) or "- 暂无"

        tc = "\n".join(
            f"- [{'✓' if t['status'] == 'resolved' else ' '}] {t['item']}"
            for t in self.tension_checklist[-8:]
        ) or "- 暂无"

        ea = " → ".join(
            f"{t['tag']}({t['intensity']})" for t in self.emotional_arc[-6:]
        ) or "暂无"

        return STRATEGY_C_CHAPTER_PROMPT.format(
            genre=NOVEL_SETUP["genre"], theme=NOVEL_SETUP["theme"],
            intent_block=intent_block, character_states=cs,
            plot_events=pe, tension_checklist=tc, emotional_arc=ea,
            num=num, title=title,
            words=NOVEL_SETUP["words_per_chapter"],
        )

    def update_memory(self, num: int, title: str, content: str) -> dict:
        self._extract_all(content)
        self.chapter_count = num
        return {
            "character_states": self.character_states,
            "plot_events": self.plot_events[-10:],
            "unresolved_threads": self.unresolved_threads[-10:],
            "emotional_arc": self.emotional_arc[-8:],
            "tension_checklist": self.tension_checklist[-10:],
            "current_intent": self.current_intent,
        }

    def context_snapshot(self) -> str:
        lines = ["# 三层记忆上下文\n"]
        lines.append("## 叙事意图")
        if self.current_intent:
            lines.append(json.dumps(self.current_intent, ensure_ascii=False, indent=2))
        lines.append("\n## 角色状态")
        for s in self.character_states:
            lines.append(f"- {json.dumps(s, ensure_ascii=False)}")
        lines.append("\n## 关键事件")
        for e in self.plot_events[-8:]:
            lines.append(f"- {e}")
        lines.append("\n## 张力清单")
        for t in self.tension_checklist[-8:]:
            lines.append(f"- [{'✓' if t['status'] == 'resolved' else ' '}] {t['item']}")
        lines.append("\n## 情感弧线")
        for e in self.emotional_arc[-6:]:
            lines.append(f"- {e['tag']}({e['intensity']})")
        return "\n".join(lines)

    def _extract_all(self, content: str) -> None:
        # 层1：结构化事实（与策略B相同提取逻辑）
        self._extract_facts(content)
        # 叙事意图提取
        self._extract_intent(content)
        # 情感弧线提取
        self._extract_emotion(content)
        # 更新张力清单
        self._update_tension()

    def _extract_facts(self, content: str) -> None:
        result = self.client.generate(
            STRATEGY_B_EXTRACT_PROMPT.format(content=content[:3000])
        )
        try:
            data = json.loads(extract_json(result.content))
        except (json.JSONDecodeError, ValueError):
            return
        for ns in data.get("character_states", []):
            idx = next(
                (i for i, e in enumerate(self.character_states) if e.get("name") == ns.get("name")),
                None,
            )
            if idx is not None:
                self.character_states[idx] = ns
            else:
                self.character_states.append(ns)
        self.plot_events.extend(data.get("plot_events", []))
        self.plot_events = self.plot_events[-20:]
        for t in data.get("unresolved_threads", []):
            if t not in self.unresolved_threads:
                self.unresolved_threads.append(t)
        self.unresolved_threads = self.unresolved_threads[-15:]

    def _extract_intent(self, content: str) -> None:
        result = self.client.generate(
            STRATEGY_C_INTENT_PROMPT.format(content=content[:3000])
        )
        try:
            self.current_intent = json.loads(extract_json(result.content))
        except (json.JSONDecodeError, ValueError):
            pass

    def _extract_emotion(self, content: str) -> None:
        result = self.client.generate(
            STRATEGY_C_EMOTION_PROMPT.format(content=content[:3000])
        )
        try:
            data = json.loads(extract_json(result.content))
            self.emotional_arc.extend(data.get("tags", []))
            self.emotional_arc = self.emotional_arc[-15:]
        except (json.JSONDecodeError, ValueError):
            pass

    def _update_tension(self) -> None:
        for t in self.unresolved_threads:
            exists = any(tc["item"] == t for tc in self.tension_checklist)
            if not exists:
                self.tension_checklist.append({"item": t, "status": "open"})
        self.tension_checklist = self.tension_checklist[-15:]


# ── 历史预生成 ────────────────────────────────────────────────

def generate_history(client: DeepSeekClient, output_dir: Path) -> list[dict[str, Any]]:
    """生成第1-5章共享历史，返回带 summary_text 的章节列表。"""
    history_dir = output_dir / "setup" / "history_chapters"
    history_dir.mkdir(parents=True, exist_ok=True)

    # 保存小说设定
    setup_path = output_dir / "setup" / "novel_setup.json"
    setup_path.write_text(json.dumps(NOVEL_SETUP, ensure_ascii=False, indent=2), encoding="utf-8")

    chapters: list[dict[str, Any]] = []
    summaries: list[str] = []

    for chapter_info in NOVEL_SETUP["outline"][:5]:
        num = chapter_info["num"]
        title = chapter_info["title"]
        logger.info(f"生成历史章节 {num}: {title}")

        # 构建上下文
        ctx_parts = [f"# 上下文摘要\n\n## 当前进度\n- 已完成：{num - 1}章\n"]
        if summaries:
            ctx_parts.append("## 剧情摘要（最近5章）\n" + "\n".join(summaries[-5:]) + "\n")
        ctx_parts.append(f"\n## 世界观\n{NOVEL_SETUP['world']}\n\n## 角色\n{NOVEL_SETUP['characters']}")
        context_text = "\n".join(ctx_parts)

        prompt = HISTORY_CHAPTER_PROMPT.format(
            context=context_text, num=num, title=title,
            words=NOVEL_SETUP["words_per_chapter"],
            genre=NOVEL_SETUP["genre"], theme=NOVEL_SETUP["theme"],
        )

        result = client.generate(prompt)

        chapter_data = {
            "num": num, "title": title,
            "content": result.content,
            "prompt": result.prompt_sent,
            "token_usage": asdict(result.usage),
        }
        chapters.append(chapter_data)

        # 生成摘要
        summary_result = client.generate(HISTORY_SUMMARY_PROMPT.format(content=result.content[:2000]))
        summary_text = f"第{num}章：{summary_result.content.strip()}"
        chapters[-1]["summary_text"] = summary_text
        summaries.append(summary_text)
        summaries = summaries[-5:]

        # 保存章节文件
        (history_dir / f"chapter_{num:03d}.md").write_text(
            f"# 第{num}章 {title}\n\n{result.content}", encoding="utf-8"
        )

    # 保存历史元数据
    (output_dir / "setup" / "history_meta.json").write_text(
        json.dumps(chapters, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    logger.info(f"历史章节生成完成，共 {len(chapters)} 章")
    return chapters


def load_history(output_dir: Path, client: DeepSeekClient) -> list[dict[str, Any]]:
    """从磁盘加载已有历史章节，补充摘要。"""
    meta_path = output_dir / "setup" / "history_meta.json"
    if meta_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8"))

    chapters: list[dict[str, Any]] = []
    history_dir = output_dir / "setup" / "history_chapters"
    for i in range(5):
        num = i + 1
        path = history_dir / f"chapter_{num:03d}.md"
        if not path.exists():
            raise FileNotFoundError(f"历史章节缺失: {path}")
        content = path.read_text(encoding="utf-8")
        # 去掉标题行
        body = re.sub(r"^# 第\d+章 .+?\n\n", "", content)
        summary_result = client.generate(HISTORY_SUMMARY_PROMPT.format(content=body[:2000]))
        chapters.append({
            "num": num,
            "title": NOVEL_SETUP["outline"][i]["title"],
            "content": body,
            "summary_text": f"第{num}章：{summary_result.content.strip()}",
        })
    return chapters


# ── 策略运行器 ────────────────────────────────────────────────

def run_strategy(
    strategy: StrategyA | StrategyB | StrategyC,
    client: DeepSeekClient,
    output_dir: Path,
) -> None:
    """运行单个策略生成第6-10章。"""
    sdir = output_dir / strategy.name
    (sdir / "chapters").mkdir(parents=True, exist_ok=True)
    (sdir / "prompts").mkdir(parents=True, exist_ok=True)
    (sdir / "context").mkdir(parents=True, exist_ok=True)

    # 保存策略元数据
    (sdir / "metadata.json").write_text(json.dumps({
        "strategy": strategy.name,
        "description": strategy.description,
        "model": client.model,
        "temperature": client.temperature,
        "timestamp": datetime.now().isoformat(),
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # 保存初始上下文
    (sdir / "context" / "initial_state.md").write_text(strategy.context_snapshot(), encoding="utf-8")

    for chapter_info in NOVEL_SETUP["outline"][5:10]:
        num = chapter_info["num"]
        title = chapter_info["title"]
        logger.info(f"[{strategy.name}] 生成第 {num} 章: {title}")

        # 保存生成前上下文
        (sdir / "context" / f"before_{num:03d}.md").write_text(
            strategy.context_snapshot(), encoding="utf-8"
        )

        # 构建并保存提示词
        prompt = strategy.build_prompt(num, title)
        (sdir / "prompts" / f"chapter_{num:03d}_prompt.md").write_text(prompt, encoding="utf-8")

        # 生成
        result = client.generate(prompt)

        # 保存章节
        (sdir / "chapters" / f"chapter_{num:03d}.md").write_text(
            f"# 第{num}章 {title}\n\n{result.content}", encoding="utf-8"
        )

        # 更新记忆
        strategy.update_memory(num, title, result.content)

        # 保存更新后上下文
        (sdir / "context" / f"after_{num:03d}.md").write_text(
            strategy.context_snapshot(), encoding="utf-8"
        )

        logger.info(f"[{strategy.name}] 第 {num} 章完成 ({len(result.content)} 字)")

    # 保存最终上下文和token用量
    (sdir / "context" / "final_state.md").write_text(strategy.context_snapshot(), encoding="utf-8")
    (sdir / "token_usage.json").write_text(
        json.dumps(client.cumulative_tokens(), ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ── 对比报告 ──────────────────────────────────────────────────

def generate_report(output_dir: Path) -> None:
    """生成对比报告。"""
    lines: list[str] = [
        "# 实验对比报告：提示词工程与记忆策略\n",
        f"> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n",
        "## 实验设计\n",
        f"- 小说：{NOVEL_SETUP['title']}（{NOVEL_SETUP['genre']}）",
        f"- 模型：deepseek-chat，temperature=0.7",
        f"- 历史章节：1-5章（共享）",
        f"- 实验章节：6-10章（每种策略独立生成）\n",
        "### 三种策略\n",
        "| 策略 | 记忆方式 | 提示词方式 |",
        "|------|----------|-----------|",
        "| A | 5章滚动摘要，200字叙述 | 5条并行要求 |",
        "| B | 结构化schema提取 | 5条并行要求 |",
        "| C | 三层记忆+叙事意图头 | 单一叙事焦点 |\n",
    ]

    # Token 用量
    lines.append("## Token 使用量\n")
    lines.append("| 策略 | Prompt Tokens | Completion Tokens | 总计 |")
    lines.append("|------|--------------|------------------|------|")
    for name in ["A_rolling_summary", "B_structured_facts", "C_intent_driven"]:
        usage_path = output_dir / name / "token_usage.json"
        if usage_path.exists():
            u = json.loads(usage_path.read_text(encoding="utf-8"))
            lines.append(f"| {name.split('_', 1)[0]} | {u['prompt_tokens']:,} | {u['completion_tokens']:,} | {u['total_tokens']:,} |")
    lines.append("")

    # 逐章对比
    for ch_idx in range(5, 10):
        num = ch_idx + 1
        title = NOVEL_SETUP["outline"][ch_idx]["title"]
        lines.append(f"## 第{num}章：{title}\n")

        for name, label in [
            ("A_rolling_summary", "策略A"),
            ("B_structured_facts", "策略B"),
            ("C_intent_driven", "策略C"),
        ]:
            ch_path = output_dir / name / "chapters" / f"chapter_{num:03d}.md"
            if ch_path.exists():
                content = ch_path.read_text(encoding="utf-8")
                body = re.sub(r"^# 第\d+章 .+?\n\n", "", content)
                char_count = len(body)
                lines.append(f"### {label}（{char_count}字）\n")
                lines.append(body)
                lines.append("\n---\n")

    # 提示词对比（第6章）
    lines.append("\n## 提示词对比（第6章）\n")
    for name, label in [
        ("A_rolling_summary", "策略A"),
        ("B_structured_facts", "策略B"),
        ("C_intent_driven", "策略C"),
    ]:
        prompt_path = output_dir / name / "prompts" / "chapter_006_prompt.md"
        if prompt_path.exists():
            lines.append(f"### {label}\n")
            lines.append(f"```\n{prompt_path.read_text(encoding='utf-8')}\n```\n")

    # 评估维度指引
    lines.append("\n## 评估维度\n")
    lines.append("请从以下维度对各策略输出进行评分（1-5分）：\n")
    lines.append("1. **事实一致性**：角色位置、实力、行为是否与前文矛盾？")
    lines.append("2. **角色连贯性**：角色性格、说话方式是否前后一致？")
    lines.append("3. **叙事推进力**：情节是否有实质推进，还是原地踏步？")
    lines.append("4. **悬念管理**：是否自然处理了已有的未解决悬念？")
    lines.append("5. **文本质量**：场景描写、对话质量、文学性")
    lines.append("6. **整体可读性**：作为小说，是否让人愿意继续读下去？")

    report_path = output_dir / "comparison_report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info(f"对比报告已生成: {report_path}")


# ── 主流程 ────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="提示词工程与记忆策略对照实验")
    parser.add_argument("--skip-history", action="store_true", help="跳过历史生成，使用已有数据")
    parser.add_argument("--strategy", choices=["A", "B", "C", "all"], default="all", help="运行哪个策略")
    parser.add_argument("--output", default="experiment_results", help="输出目录")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    logger.info(f"输出目录: {output_dir.resolve()}")

    client = DeepSeekClient()

    # 阶段1：历史章节
    if args.skip_history:
        logger.info("加载已有历史章节...")
        history = load_history(output_dir, client)
    else:
        logger.info("阶段1：生成共享历史章节（1-5章）...")
        history = generate_history(client, output_dir)

    # 阶段2：策略实验
    strategies_map: dict[str, StrategyA | StrategyB | StrategyC] = {
        "A": StrategyA(client),
        "B": StrategyB(client),
        "C": StrategyC(client),
    }
    to_run = list(strategies_map.keys()) if args.strategy == "all" else [args.strategy]

    for key in to_run:
        strategy = strategies_map[key]
        logger.info(f"阶段2：运行策略 {strategy.name}...")
        # 每个策略需要独立的历史初始化，所以重置 client 的 usage log 来分策略统计
        # 实际上 client 共享，我们通过保存上下文快照来追踪
        strategy.init_from_history(history)
        run_strategy(strategy, client, output_dir)

    # 阶段3：对比报告
    logger.info("阶段3：生成对比报告...")
    generate_report(output_dir)

    # 打印总结
    total = client.cumulative_tokens()
    logger.info(f"实验完成！总 token 用量: {total['total_tokens']:,}")
    logger.info(f"结果保存在: {output_dir.resolve()}")


if __name__ == "__main__":
    main()
