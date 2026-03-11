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
        """构建章节索引

        Args:
            number: 章节号
            title: 章节标题
            content: 章节正文（用于关键词和场景提取）
            summary: 章节摘要（优先用于关键词提取）
            characters: 出场角色列表。如果为空，系统将尝试从正文中自动抽取中文人名
        """
        # 提取关键词作为关键事件
        keywords = self.extract_keywords(summary or content, top_k=5)

        # 提取场景（简单规则：包含"在""来到""进入"等词的短语）
        locations = []
        location_patterns = re.findall(r'(?:在|来到|进入|来到)([^，。]{2,8})', content)
        locations = list(set(location_patterns))[:3]

        # 处理角色列表：如果未提供，尝试从正文中抽取中文人名
        if not characters or len(characters) == 0:
            # 简单的中文人名模式：常见姓氏 + 1-2个汉字
            # 包含了最常见的150个中文姓氏（按人口排序）
            common_surnames = (
                '王李张刘陈杨黄赵周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧'
                '程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜'
                '范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段漕钱汤尹黎'
                '易常武乔贺赖龚文覃谈苗任申温季董杜童鱼范关辛牟'
                '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华'
                '金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞'
            )
            # 常见动词/介词，跟在人名后面的
            common_verbs = '来去到说看听想做是生在把被让叫问告诉回答点头微笑'
            # 匹配2字人名（姓氏+1字名），后面跟标点、空格、连接词或动词
            two_char_pattern = r'([' + common_surnames + r'][一-龥])([，。！？、：;""\s与和等及同跟' + common_verbs + r'])'
            two_char_matches = re.findall(two_char_pattern, content)

            # 匹配3字人名（姓氏+2字名），后面跟标点、空格、连接词或动词
            # 注意：3字名限制为常见人名用字，减少误匹配
            common_name_chars = '建国强军华文平志伟东海波明永刚国亮建平辉'
            three_char_pattern = r'([' + common_surnames + r'][' + common_name_chars + r']{2})([，。！？、：;""\s与和等及同跟' + common_verbs + r'])'
            three_char_matches = re.findall(three_char_pattern, content)

            # 收集结果
            extracted = []
            for match in two_char_matches:
                if isinstance(match, tuple) and match[0]:
                    extracted.append(match[0])
            for match in three_char_matches:
                if isinstance(match, tuple) and match[0]:
                    extracted.append(match[0])

            # 去重并限制数量
            extracted = list(set(extracted))[:5]
            characters = extracted  # 将抽取的结果赋值给 characters

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
