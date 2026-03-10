"""Ollama 真实连接集成测试"""

import pytest

from auto_novel.models.ollama_client import OllamaClient


@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_ollama_health_check(ollama_enabled, ollama_host):
    """测试真实 Ollama 服务健康检查"""
    if not ollama_enabled:
        pytest.skip("需要设置 OLLAMA_TEST_ENABLED=true")

    client = OllamaClient(host=ollama_host)
    result = await client.check_health()

    assert result is True, "Ollama 服务不可用"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_ollama_generate(ollama_enabled, ollama_host):
    """测试真实 Ollama 文本生成"""
    if not ollama_enabled:
        pytest.skip("需要设置 OLLAMA_TEST_ENABLED=true")

    client = OllamaClient(host=ollama_host)
    result = await client.generate("你好", stream=False)

    assert isinstance(result, str)
    assert len(result) > 0
