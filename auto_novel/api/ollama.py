"""Ollama 模型管理模块

提供 Ollama 模型列表、详情查询和思考能力检测功能。
"""

import asyncio
from typing import List, Optional
from dataclasses import dataclass

import httpx


from ..config import get_ollama_host


# =============================================================================
# 数据模型
# =============================================================================


@dataclass
class ModelDetails:
    """模型详细信息"""

    name: str
    """模型完整名称，如 deepseek-r1:7b"""

    model: str
    """模型标识符"""

    modified_at: str
    """最后修改时间 (ISO 格式)"""

    size: int
    """模型大小（字节）"""

    digest: str
    """模型摘要"""

    details: dict
    """原始详细信息"""

    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "name": self.name,
            "model": self.model,
            "modifiedAt": self.modified_at,
            "size": self.size,
            "digest": self.digest,
            "details": self.details,
        }


@dataclass
class ModelInfo:
    """模型基础信息"""

    name: str
    """模型名称"""

    size: int
    """模型大小（字节）"""

    digest: str
    """模型摘要"""

    modified_at: str
    """最后修改时间"""

    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "name": self.name,
            "size": self.size,
            "digest": self.digest,
            "modifiedAt": self.modified_at,
        }


# =============================================================================
# 异常定义
# =============================================================================


class OllamaConnectionError(Exception):
    """Ollama 服务连接异常"""


class OllamaAPIError(Exception):
    """Ollama API 调用异常"""


# =============================================================================
# 模型管理器
# =============================================================================


class OllamaModelManager:
    """Ollama 模型管理器

    提供模型列表查询、详情获取和思考能力检测功能。
    """

    # 支持思考的模型名称模式
    THINKING_PATTERNS = [
        "r1",  # DeepSeek-R1 系列
        "qwq",  # QwQ 系列
        "think",  # 包含 think 的模型
    ]

    def __init__(self, host: Optional[str] = None, timeout: float = 10.0):
        """初始化模型管理器

        Args:
            host: Ollama 服务地址，默认从配置读取
            timeout: 请求超时时间（秒）
        """
        self.host = host or get_ollama_host()
        self.timeout = timeout

    def _is_thinking_model(self, model_name: str) -> bool:
        """判断模型是否支持思考

        Args:
            model_name: 模型名称

        Returns:
            是否支持思考能力
        """
        name_lower = model_name.lower()
        return any(pattern in name_lower for pattern in self.THINKING_PATTERNS)

    async def list_models(self) -> List[ModelInfo]:
        """获取模型列表

        调用 Ollama /api/tags 接口获取已安装的模型列表。

        Returns:
            模型信息列表

        Raises:
            OllamaConnectionError: 连接 Ollama 服务失败
            OllamaAPIError: API 调用失败
        """
        url = f"{self.host}/api/tags"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                models = []
                for model in data.get("models", []):
                    models.append(
                        ModelInfo(
                            name=model.get("name", ""),
                            size=model.get("size", 0),
                            digest=model.get("digest", ""),
                            modified_at=model.get("modified_at", ""),
                        )
                    )

                return models

        except httpx.ConnectError as e:
            raise OllamaConnectionError(
                f"无法连接到 Ollama 服务 ({self.host}): {e}"
            )
        except httpx.HTTPStatusError as e:
            raise OllamaAPIError(f"API 请求失败: {e.response.status_code}")
        except Exception as e:
            raise OllamaAPIError(f"获取模型列表失败: {e}")

    async def get_model_info(self, model_name: str) -> Optional[ModelDetails]:
        """获取模型详细信息

        Args:
            model_name: 模型名称，如 deepseek-r1:7b

        Returns:
            模型详细信息，如果模型不存在则返回 None

        Raises:
            OllamaConnectionError: 连接 Ollama 服务失败
            OllamaAPIError: API 调用失败
        """
        url = f"{self.host}/api/show"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json={"name": model_name})
                response.raise_for_status()
                data = response.json()

                # 检查是否返回了有效数据
                if "error" in data:
                    return None

                return ModelDetails(
                    name=model_name,
                    model=data.get("model", ""),
                    modified_at=data.get("modified_at", ""),
                    size=data.get("size", 0),
                    digest=data.get("digest", ""),
                    details=data,
                )

        except httpx.ConnectError as e:
            raise OllamaConnectionError(
                f"无法连接到 Ollama 服务 ({self.host}): {e}"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise OllamaAPIError(f"API 请求失败: {e.response.status_code}")
        except Exception as e:
            raise OllamaAPIError(f"获取模型信息失败: {e}")

    async def get_thinking_capable_models(self) -> List[ModelInfo]:
        """获取支持思考的模型列表

        根据模型名称特征筛选出可能支持思考过程的模型。

        Returns:
            支持思考的模型列表

        Raises:
            OllamaConnectionError: 连接 Ollama 服务失败
            OllamaAPIError: API 调用失败
        """
        all_models = await self.list_models()
        return [
            model for model in all_models if self._is_thinking_model(model.name)
        ]

    async def check_service_health(self) -> bool:
        """检查 Ollama 服务健康状态

        Returns:
            服务是否健康
        """
        try:
            url = f"{self.host}/api/version"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                return response.status_code == 200
        except Exception:
            return False


# =============================================================================
# 同步包装器（用于向后兼容）
# =============================================================================


def run_sync(coro):
    """同步运行异步函数的包装器

    Args:
        coro: 协程对象

    Returns:
        协程的返回值
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(coro)


class OllamaModelManagerSync:
    """Ollama 模型管理器同步版本

    提供与 OllamaModelManager 相同的接口，但使用同步调用。
    适合在非异步环境中使用。
    """

    def __init__(self, host: Optional[str] = None, timeout: float = 10.0):
        """初始化同步模型管理器

        Args:
            host: Ollama 服务地址，默认从配置读取
            timeout: 请求超时时间（秒）
        """
        self._async_manager = OllamaModelManager(host=host, timeout=timeout)

    def list_models(self) -> List[ModelInfo]:
        """获取模型列表（同步）

        Returns:
            模型信息列表
        """
        return run_sync(self._async_manager.list_models())

    def get_model_info(self, model_name: str) -> Optional[ModelDetails]:
        """获取模型详细信息（同步）

        Args:
            model_name: 模型名称

        Returns:
            模型详细信息
        """
        return run_sync(self._async_manager.get_model_info(model_name))

    def get_thinking_capable_models(self) -> List[ModelInfo]:
        """获取支持思考的模型列表（同步）

        Returns:
            支持思考的模型列表
        """
        return run_sync(self._async_manager.get_thinking_capable_models())

    def check_service_health(self) -> bool:
        """检查服务健康状态（同步）

        Returns:
            服务是否健康
        """
        return run_sync(self._async_manager.check_service_health())
