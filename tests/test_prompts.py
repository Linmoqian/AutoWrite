# -*- coding: utf-8 -*-
"""提示词模板测试"""

import pytest
from auto_novel.agents.prompts import PromptTemplates


class TestPromptTemplates:
    """PromptTemplates 测试类"""

    def test_system_novel_writer_exists(self):
        """测试系统角色设定存在"""
        assert hasattr(PromptTemplates, "SYSTEM_NOVEL_WRITER")
        assert isinstance(PromptTemplates.SYSTEM_NOVEL_WRITER, str)
        assert "网络文学作家" in PromptTemplates.SYSTEM_NOVEL_WRITER

    def test_genre_configs_structure(self):
        """测试类型配置结构正确"""
        assert hasattr(PromptTemplates, "GENRE_CONFIGS")
        assert isinstance(PromptTemplates.GENRE_CONFIGS, dict)

        # 验证四种类型都存在
        expected_genres = ["xuanhuan", "dushi", "yanqing", "kehuan"]
        for genre in expected_genres:
            assert genre in PromptTemplates.GENRE_CONFIGS

    def test_genre_config_content(self):
        """测试类型配置内容正确"""
        # 玄幻配置
        xuanhuan = PromptTemplates.GENRE_CONFIGS["xuanhuan"]
        assert xuanhuan["name"] == "玄幻"
        assert "修炼" in xuanhuan["elements"]
        assert "境界" in xuanhuan["elements"]
        assert "热血" in xuanhuan["style"]

        # 都市配置
        dushi = PromptTemplates.GENRE_CONFIGS["dushi"]
        assert dushi["name"] == "都市"
        assert "职场" in dushi["elements"]

        # 言情配置
        yanqing = PromptTemplates.GENRE_CONFIGS["yanqing"]
        assert yanqing["name"] == "言情"
        assert "爱情" in yanqing["elements"]

        # 科幻配置
        kehuan = PromptTemplates.GENRE_CONFIGS["kehuan"]
        assert kehuan["name"] == "科幻"
        assert "科技" in kehuan["elements"]

    def test_get_worldbuilding_prompt_contains_genre_elements(self):
        """测试世界观生成提示词包含正确的类型元素"""
        # 测试玄幻类型
        prompt = PromptTemplates.get_worldbuilding_prompt("xuanhuan", "修仙问道")
        assert "玄幻" in prompt
        assert "修炼" in prompt
        assert "灵气" in prompt
        assert "境界" in prompt
        assert "修仙问道" in prompt

        # 测试都市类型
        prompt = PromptTemplates.get_worldbuilding_prompt("dushi", "都市生活")
        assert "都市" in prompt
        assert "职场" in prompt

        # 测试言情类型
        prompt = PromptTemplates.get_worldbuilding_prompt("yanqing", "青春校园")
        assert "言情" in prompt
        assert "爱情" in prompt

        # 测试科幻类型
        prompt = PromptTemplates.get_worldbuilding_prompt("kehuan", "星际探索")
        assert "科幻" in prompt
        assert "科技" in prompt

    def test_get_worldbuilding_prompt_structure(self):
        """测试世界观生成提示词结构"""
        prompt = PromptTemplates.get_worldbuilding_prompt("xuanhuan", "测试主题")

        # 验证包含必要的部分
        assert "世界背景" in prompt
        assert "核心元素设定" in prompt
        assert "地理环境" in prompt
        assert "力量体系" in prompt
        assert "社会结构" in prompt
        assert "JSON" in prompt

    def test_get_character_prompt(self):
        """测试角色设计提示词"""
        world_info = {
            "world_name": "修仙界",
            "background": "一个充满灵气的修仙世界",
        }

        # 测试主角
        prompt = PromptTemplates.get_character_prompt("protagonist", world_info)
        assert "主角" in prompt
        assert "修仙界" in prompt
        assert "基本信息" in prompt
        assert "外貌特征" in prompt
        assert "性格特点" in prompt
        assert "背景故事" in prompt
        assert "能力设定" in prompt

        # 测试反派
        prompt = PromptTemplates.get_character_prompt("antagonist", world_info)
        assert "反派" in prompt

        # 测试配角
        prompt = PromptTemplates.get_character_prompt("supporting", world_info)
        assert "配角" in prompt

    def test_get_outline_prompt(self):
        """测试大纲生成提示词"""
        genre = "xuanhuan"
        world_info = {"world_name": "修仙界", "background": "一个修仙的世界"}
        main_character = {
            "name": "林风",
            "identity": "散修",
            "background": {"动机": "追求长生"},
        }
        total_chapters = 100

        prompt = PromptTemplates.get_outline_prompt(
            genre, world_info, main_character, total_chapters
        )

        # 验证包含必要信息
        assert "100章" in prompt
        assert "玄幻" in prompt
        assert "修仙界" in prompt
        assert "林风" in prompt
        assert "散修" in prompt
        assert "追求长生" in prompt
        assert "故事主线" in prompt
        assert "剧情结构" in prompt
        assert "分章大纲" in prompt

    def test_get_chapter_prompt_contains_chapter_number(self):
        """测试章节生成提示词包含章节号"""
        outline = {
            "main_plot": {"基调": "热血"},
            "chapters": [
                {
                    "chapter": 1,
                    "title": "初入江湖",
                    "summary": "主角初入修仙界",
                    "characters": ["林风"],
                    "key_events": ["觉醒", "拜师"],
                }
            ],
        }
        world_info = {"world_name": "修仙界", "background": "修仙世界"}
        characters = {
            "林风": {"identity": "散修", "personality": {"特征": ["坚毅", "聪明"]}}
        }

        prompt = PromptTemplates.get_chapter_prompt(
            chapter_num=1,
            title="初入江湖",
            outline=outline,
            previous_summary=None,
            world_info=world_info,
            characters=characters,
        )

        # 验证章节号
        assert "第1章" in prompt
        assert "初入江湖" in prompt

        # 验证包含必要信息
        assert "觉醒" in prompt or "拜师" in prompt
        assert "2000-4000字" in prompt

    def test_get_chapter_prompt_with_previous_summary(self):
        """测试章节生成提示词包含上一章摘要"""
        outline = {
            "main_plot": {"基调": "热血"},
            "chapters": [
                {
                    "chapter": 2,
                    "title": "修炼之路",
                    "summary": "主角开始修炼",
                    "characters": ["林风"],
                    "key_events": ["突破"],
                }
            ],
        }
        world_info = {"world_name": "修仙界", "background": "修仙世界"}
        characters = {
            "林风": {"identity": "散修", "personality": {"特征": ["坚毅"]}}
        }

        prompt = PromptTemplates.get_chapter_prompt(
            chapter_num=2,
            title="修炼之路",
            outline=outline,
            previous_summary="上一章林风觉醒了灵根",
            world_info=world_info,
            characters=characters,
        )

        assert "第2章" in prompt
        assert "上一章摘要" in prompt
        assert "林风觉醒了灵根" in prompt

    def test_get_summary_prompt(self):
        """测试摘要生成提示词"""
        chapter_content = "林风站在山顶，望着远方的云海，心中充满了对未来的期待..."

        prompt = PromptTemplates.get_summary_prompt(chapter_content)

        assert "摘要" in prompt
        assert "出场人物" in prompt
        assert "关键信息" in prompt
        assert "JSON" in prompt
        assert "林风" in prompt

    def test_get_summary_prompt_truncates_long_content(self):
        """测试摘要生成提示词截断过长内容"""
        long_content = "测试内容" * 1000

        prompt = PromptTemplates.get_summary_prompt(long_content)

        # 验证提示词不会过长
        assert len(prompt) < 5000

    def test_get_all_genres(self):
        """测试获取所有类型"""
        genres = PromptTemplates.get_all_genres()

        assert isinstance(genres, dict)
        assert genres["xuanhuan"] == "玄幻"
        assert genres["dushi"] == "都市"
        assert genres["yanqing"] == "言情"
        assert genres["kehuan"] == "科幻"

    def test_get_genre_elements(self):
        """测试获取类型元素"""
        elements = PromptTemplates.get_genre_elements("xuanhuan")

        assert isinstance(elements, list)
        assert "修炼" in elements
        assert "灵气" in elements
        assert "境界" in elements

    def test_get_genre_elements_unknown_genre(self):
        """测试获取未知类型元素返回空列表"""
        elements = PromptTemplates.get_genre_elements("unknown")
        assert elements == []

    def test_worldbuilding_prompt_unknown_genre_uses_default(self):
        """测试未知类型使用默认配置"""
        prompt = PromptTemplates.get_worldbuilding_prompt("unknown", "测试")
        # 应该使用玄幻作为默认
        assert "修炼" in prompt


class TestPromptTemplatesIntegration:
    """提示词模板集成测试"""

    def test_full_workflow_prompts(self):
        """测试完整工作流的提示词生成"""
        # 1. 世界观构建
        world_prompt = PromptTemplates.get_worldbuilding_prompt(
            "xuanhuan", "少年修仙"
        )
        assert "少年修仙" in world_prompt

        # 2. 角色设计
        world_info = {"world_name": "修仙界", "background": "修仙世界"}
        character_prompt = PromptTemplates.get_character_prompt(
            "protagonist", world_info
        )
        assert "主角" in character_prompt

        # 3. 大纲生成
        main_character = {
            "name": "林风",
            "identity": "散修",
            "background": {"动机": "成仙"},
        }
        outline_prompt = PromptTemplates.get_outline_prompt(
            "xuanhuan", world_info, main_character, 50
        )
        assert "50章" in outline_prompt

        # 4. 章节生成
        outline = {
            "main_plot": {"基调": "热血"},
            "chapters": [
                {
                    "chapter": 1,
                    "title": "开始",
                    "summary": "故事开始",
                    "characters": ["林风"],
                    "key_events": ["觉醒"],
                }
            ],
        }
        characters = {"林风": {"identity": "散修", "personality": {"特征": ["坚毅"]}}}
        chapter_prompt = PromptTemplates.get_chapter_prompt(
            1, "开始", outline, None, world_info, characters
        )
        assert "第1章" in chapter_prompt

        # 5. 摘要生成
        summary_prompt = PromptTemplates.get_summary_prompt("章节内容...")
        assert "摘要" in summary_prompt
