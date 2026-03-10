"""Pytest 共享 fixtures"""

import os

import pytest


@pytest.fixture(scope="session")
def ollama_enabled():
    """检查是否启用 Ollama 真实连接测试"""
    return os.getenv("OLLAMA_TEST_ENABLED", "false").lower() == "true"


@pytest.fixture(scope="session")
def ollama_host():
    """获取测试用 Ollama 地址"""
    return os.getenv("OLLAMA_HOST", "http://localhost:11434")
