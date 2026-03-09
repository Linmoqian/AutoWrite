"""Ollama 客户端测试模块"""

import pytest

from auto_novel.models.ollama_client import OllamaClient, OllamaConfig


class TestOllamaConfig:
    """OllamaConfig 测试类"""

    def test_ollama_config_defaults(self):
        """测试默认配置"""
        config = OllamaConfig()
        assert config.host == "http://localhost:11434"
        assert config.model == "deepseek-r1:7b"
        assert config.timeout == 300

    def test_ollama_config_custom(self):
        """测试自定义配置"""
        config = OllamaConfig(
            host="http://custom:8080", model="qwen2.5:7b", timeout=600
        )
        assert config.host == "http://custom:8080"
        assert config.model == "qwen2.5:7b"
        assert config.timeout == 600


class TestOllamaClient:
    """OllamaClient 测试类"""

    def test_ollama_client_initialization(self):
        """测试客户端默认初始化"""
        client = OllamaClient()
        assert client.host == "http://localhost:11434"
        assert client.model == "deepseek-r1:7b"
        assert client.config is not None

    def test_ollama_client_custom_config(self):
        """测试客户端自定义配置"""
        config = OllamaConfig(host="http://custom:8080", model="qwen2.5:7b")
        client = OllamaClient(config)
        assert client.host == "http://custom:8080"
        assert client.model == "qwen2.5:7b"
        assert client.config == config

    def test_ollama_client_config_attribute(self):
        """测试客户端配置属性"""
        client = OllamaClient()
        assert hasattr(client, "config")
        assert hasattr(client, "host")
        assert hasattr(client, "model")
