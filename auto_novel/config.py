"""配置模块"""

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    """全局配置"""

    # Ollama 配置
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "deepseek-r1:7b")

    # 番茄小说配置
    fanqie_username: str = os.getenv("FANQIE_USERNAME", "")
    fanqie_password: str = os.getenv("FANQIE_PASSWORD", "")

    # 创作配置
    novel_type: str = os.getenv("NOVEL_TYPE", "xuanhuan")
    chapters_per_day: int = int(os.getenv("CHAPTERS_PER_DAY", "2"))
    words_per_chapter: int = int(os.getenv("WORDS_PER_CHAPTER", "3000"))

    # 数据目录
    data_dir: str = os.getenv("DATA_DIR", "data")


# 全局配置实例
config = Config()


def get_llm_client():
    """获取 LLM 客户端实例"""
    from auto_novel.models.ollama_client import OllamaClient, OllamaConfig

    ollama_config = OllamaConfig(
        host=config.ollama_host, model=config.ollama_model
    )
    return OllamaClient(ollama_config)
