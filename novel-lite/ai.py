"""AI 调用模块"""

import time

import ollama

from config import CONFIG


def generate(prompt: str, context: str = "", retries: int = 3) -> str:
    """调用 Ollama 生成文本，带重试"""
    full_prompt = f"{context}\n\n{prompt}" if context else prompt
    for attempt in range(retries):
        try:
            response = ollama.chat(
                model=CONFIG["model"],
                messages=[{"role": "user", "content": full_prompt}],
                options={"num_ctx": 4096}
            )
            return response["message"]["content"]
        except Exception as e:
            if attempt == retries - 1:
                raise RuntimeError(f"Ollama 调用失败: {e}")
            time.sleep(2 ** attempt)


def generate_stream(prompt: str, context: str = ""):
    """流式调用 Ollama，yield 每个文本片段"""
    full_prompt = f"{context}\n\n{prompt}" if context else prompt
    stream = ollama.chat(
        model=CONFIG["model"],
        messages=[{"role": "user", "content": full_prompt}],
        options={"num_ctx": 4096},
        stream=True,
    )
    for chunk in stream:
        content = chunk.get("message", {}).get("content", "")
        if content:
            yield content
