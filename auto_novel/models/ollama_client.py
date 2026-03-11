"""Ollama 客户端封装模块"""

import json
import os
from typing import Any, AsyncGenerator, Dict, Optional

import aiohttp

from dataclasses import dataclass


@dataclass
class OllamaConfig:
    """Ollama 配置类"""

    host: str = "http://localhost:11434"
    model: str = os.getenv("OLLAMA_MODEL", "qwen3:8b")
    timeout: int = 300


@dataclass
class StreamChunk:
    """流式输出数据块"""

    content: str = ""
    thinking: str = ""
    done: bool = False


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
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式生成文本

        Args:
            prompt: 输入提示词
            system: 系统提示词

        Yields:
            Dict[str, Any]: 包含 {content, thinking, done} 的字典
                - content: str - 生成的响应内容
                - thinking: str - 思考过程内容
                - done: bool - 是否完成
        """
        url = f"{self.host}/api/generate"
        payload = {"model": self.model, "prompt": prompt, "stream": True}
        if system:
            payload["system"] = system

        timeout = aiohttp.ClientTimeout(total=self.config.timeout)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as resp:
                buffer = ""
                async for chunk in resp.content.iter_any():
                    if chunk:
                        buffer += chunk.decode("utf-8")
                        # Ollama 每行返回一个 JSON 对象
                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            if line.strip():
                                try:
                                    data = json.loads(line)
                                    chunk_data = StreamChunk(
                                        content=data.get("response", ""),
                                        thinking=data.get("thinking", ""),
                                        done=data.get("done", False)
                                    )
                                    yield {
                                        "content": chunk_data.content,
                                        "thinking": chunk_data.thinking,
                                        "done": chunk_data.done
                                    }
                                    if data.get("done"):
                                        return
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
