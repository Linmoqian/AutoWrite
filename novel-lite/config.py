"""配置管理模块"""

import os
from pathlib import Path

import yaml


def load_config() -> dict:
    """加载配置文件，支持环境变量覆盖"""
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    # 环境变量覆盖
    if os.getenv("OLLAMA_MODEL"):
        config["model"] = os.getenv("OLLAMA_MODEL")
    if os.getenv("OLLAMA_TIMEOUT"):
        config["timeout"] = int(os.getenv("OLLAMA_TIMEOUT"))

    return config


CONFIG = load_config()
