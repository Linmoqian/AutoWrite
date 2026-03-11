"""Ollama 模型管理 API 测试"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from auto_novel.api.ollama import (
    OllamaModelManager,
    ModelInfo,
    ModelDetails,
    OllamaConnectionError,
    OllamaAPIError,
)


@pytest.fixture
def mock_ollama_response():
    """模拟 Ollama /api/tags 响应"""
    return {
        "models": [
            {
                "name": "deepseek-r1:7b",
                "modified_at": "2025-01-15T10:30:00Z",
                "size": 4567890123,
                "digest": "sha256:abc123",
            },
            {
                "name": "qwen2.5:7b",
                "modified_at": "2025-01-10T08:00:00Z",
                "size": 4567890123,
                "digest": "sha256:def456",
            },
        ]
    }


@pytest.fixture
def mock_model_details():
    """模拟 Ollama /api/show 响应"""
    return {
        "model": "deepseek-r1:7b",
        "modified_at": "2025-01-15T10:30:00Z",
        "size": 4567890123,
        "digest": "sha256:abc123",
        "details": {
            "format": "gguf",
            "family": "qwen2",
            "families": ["qwen2", "bert"],
            "parameter_size": "7.6B",
            "quantization_level": "Q4_K_M",
        },
    }


class TestOllamaModelManager:
    """OllamaModelManager 测试"""

    @pytest.mark.asyncio
    async def test_list_models_success(self, mock_ollama_response):
        """测试成功获取模型列表"""
        manager = OllamaModelManager()

        # Mock httpx.AsyncClient
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_ollama_response
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            models = await manager.list_models()

            assert len(models) == 2
            assert models[0].name == "deepseek-r1:7b"
            assert models[0].size == 4567890123
            assert models[1].name == "qwen2.5:7b"

    @pytest.mark.asyncio
    async def test_list_models_connection_error(self):
        """测试连接失败"""
        manager = OllamaModelManager()

        import httpx

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get.side_effect = httpx.ConnectError("Connection refused")
            mock_client.__aenter__.side_effect = httpx.ConnectError("Connection refused")
            mock_client.__aexit__ = AsyncMock()
            mock_client_cls.return_value = mock_client

            with pytest.raises(OllamaConnectionError):
                await manager.list_models()

    @pytest.mark.asyncio
    async def test_get_model_info_success(self, mock_model_details):
        """测试成功获取模型详情"""
        manager = OllamaModelManager()

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_model_details
        mock_response.raise_for_status = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            details = await manager.get_model_info("deepseek-r1:7b")

            assert details is not None
            assert details.name == "deepseek-r1:7b"
            assert details.size == 4567890123
            # details 字段包含完整响应，所以需要访问嵌套的 details
            assert details.details["details"]["parameter_size"] == "7.6B"

    @pytest.mark.asyncio
    async def test_get_model_info_not_found(self):
        """测试模型不存在"""
        manager = OllamaModelManager()

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"error": "model not found"}
        mock_response.raise_for_status = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            details = await manager.get_model_info("nonexistent:latest")

            assert details is None

    @pytest.mark.asyncio
    async def test_get_thinking_capable_models(self, mock_ollama_response):
        """测试获取支持思考的模型列表"""
        manager = OllamaModelManager()

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_ollama_response
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            thinking_models = await manager.get_thinking_capable_models()

            assert len(thinking_models) == 1
            assert thinking_models[0].name == "deepseek-r1:7b"

    @pytest.mark.asyncio
    async def test_check_service_health_success(self):
        """测试健康检查成功"""
        manager = OllamaModelManager()

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            healthy = await manager.check_service_health()

            assert healthy is True

    @pytest.mark.asyncio
    async def test_check_service_health_failure(self):
        """测试健康检查失败"""
        manager = OllamaModelManager()

        with patch("httpx.AsyncClient") as mock_client_cls:
            # 创建一个能够正常进入上下文但 get 会抛出异常的 mock
            async def mock_context_manager():
                class MockClient:
                    async def get(self, url):
                        raise Exception("Connection refused")

                    async def __aenter__(self):
                        return self

                    async def __aexit__(self, *args):
                        pass

                return MockClient()

            mock_client_cls.side_effect = mock_context_manager

            healthy = await manager.check_service_health()

            assert healthy is False

    def test_is_thinking_model(self):
        """测试思考模型识别"""
        manager = OllamaModelManager()

        assert manager._is_thinking_model("deepseek-r1:7b") is True
        assert manager._is_thinking_model("deepseek-R1:14b") is True
        assert manager._is_thinking_model("qwq:32b") is True
        assert manager._is_thinking_model("thinking-model") is True
        assert manager._is_thinking_model("qwen2.5:7b") is False
        assert manager._is_thinking_model("llama3:8b") is False


class TestModelInfo:
    """ModelInfo 测试"""

    def test_to_dict(self):
        """测试转换为字典"""
        model = ModelInfo(
            name="deepseek-r1:7b",
            size=4567890123,
            digest="sha256:abc123",
            modified_at="2025-01-15T10:30:00Z",
        )

        result = model.to_dict()

        assert result == {
            "name": "deepseek-r1:7b",
            "size": 4567890123,
            "digest": "sha256:abc123",
            "modifiedAt": "2025-01-15T10:30:00Z",
        }


class TestModelDetails:
    """ModelDetails 测试"""

    def test_to_dict(self):
        """测试转换为字典"""
        details = ModelDetails(
            name="deepseek-r1:7b",
            model="deepseek-r1",
            modified_at="2025-01-15T10:30:00Z",
            size=4567890123,
            digest="sha256:abc123",
            details={"format": "gguf"},
        )

        result = details.to_dict()

        assert result == {
            "name": "deepseek-r1:7b",
            "model": "deepseek-r1",
            "modifiedAt": "2025-01-15T10:30:00Z",
            "size": 4567890123,
            "digest": "sha256:abc123",
            "details": {"format": "gguf"},
        }


class TestOllamaAPIEndpoints:
    """Ollama API 端点测试"""

    def test_health_endpoint(self, client):
        """测试健康检查端点"""
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            response = client.get("/api/ollama/health")

            assert response.status_code == 200
            data = response.json()
            assert data["healthy"] is True
            assert data["host"] == "http://localhost:11434"

    def test_models_endpoint(self, client):
        """测试模型列表端点"""
        mock_response_data = {
            "models": [
                {
                    "name": "deepseek-r1:7b",
                    "size": 4567890123,
                    "digest": "sha256:abc123",
                    "modified_at": "2025-01-15T10:30:00Z",
                }
            ]
        }

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            response = client.get("/api/ollama/models")

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            assert len(data["models"]) == 1
            assert data["models"][0]["name"] == "deepseek-r1:7b"

    def test_thinking_models_endpoint(self, client):
        """测试思考模型列表端点"""
        mock_response_data = {
            "models": [
                {
                    "name": "deepseek-r1:7b",
                    "size": 4567890123,
                    "digest": "sha256:abc123",
                    "modified_at": "2025-01-15T10:30:00Z",
                }
            ]
        }

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        mock_response.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()

        with patch("httpx.AsyncClient", return_value=mock_client):
            response = client.get("/api/ollama/models/thinking")

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            assert data["models"][0]["name"] == "deepseek-r1:7b"
