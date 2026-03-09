"""Ollama 客户端封装模块"""

import json
from typing import AsyncGenerator, Optional

import aiohttp

from dataclasses import dataclass


@dataclass
class OllamaConfig:
    """Ollama 配置类"""

    host: str = "http://localhost:11434"
    model: str = "deepseek-r1:7b"
    timeout: int = 300


class OllamaClient:
    """Ollama API 客户端"""

    def __init__(self, config: Optional[OllamaConfig] = None):
        self.config = config or OllamaConfig()
        self.host = self.config.host
        self.model = self.config.model

    async def generate(
        self, prompt: str, system: Optional[str] = None, stream: bool = False
    ) -> str:
        """生成文本

        Args:
            prompt: 输入提示词
            system: 系统提示词
            stream: 是否流式输出

        Returns:
            生成的文本内容
        """
        url = f"{self.host}/api/generate"
        payload = {"model": self.model, "prompt": prompt, "stream": stream}
        if system:
            payload["system"] = system

        timeout = aiohttp.ClientTimeout(total=self.config.timeout)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as resp:
                data = await resp.json()
                return data.get("response", "")

    async def generate_stream(
        self, prompt: str, system: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """流式生成文本

        Args:
            prompt: 输入提示词
            system: 系统提示词

        Yields:
            生成的文本片段
        """
        url = f"{self.host}/api/generate"
        payload = {"model": self.model, "prompt": prompt, "stream": True}
        if system:
            payload["system"] = system

        timeout = aiohttp.ClientTimeout(total=self.config.timeout)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as resp:
                async for line in resp.content:
                    if line:
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                        except json.JSONDecodeError:
                            continue

    async def check_health(self) -> bool:
        """检查服务健康状态

        Returns:
            服务是否健康
        """
        try:
            timeout = aiohttp.ClientTimeout(total=5)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(f"{self.host}/api/version") as resp:
                    return resp.status == 200
        except Exception:
            return False
