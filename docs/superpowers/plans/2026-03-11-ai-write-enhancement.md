# AI 写作页面增强实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强 AI 写作页面，支持模型选择、显示思考过程、流式输出和全文滚动查看。

**Architecture:**
- 后端：添加模型列表 API，修改流式输出 API 区分 thinking/response
- 前端：添加模型选择器、思考过程可折叠显示、内容自动滚动（支持手动回滚）

**Tech Stack:**
- 后端：FastAPI, SSE (sse-starlette), Ollama API
- 前端：Next.js 16, React hooks, Server-Sent Events, Tailwind CSS

---

## File Structure

```
auto_novel/api/
├── routes.py          # 添加模型列表 API，修改流式 API
└── ollama.py          # 新建：Ollama 模型管理模块

kanban/src/
├── app/write/page.tsx # 重写：添加模型选择、思考显示、滚动控制
└── lib/ollama.ts      # 新建：Ollama API 客户端封装
```

---

## Chunk 1: 后端 - 模型列表 API

### Task 1: 创建 Ollama 模型管理模块

**Files:**
- Create: `auto_novel/api/ollama.py`

- [ ] **Step 1: 创建模块文件**

```python
"""Ollama 模型管理模块

提供模型列表查询、模型信息获取等功能
"""

import httpx
from typing import List, Dict, Optional
from ..config import get_ollama_host


class OllamaModelManager:
    """Ollama 模型管理器"""

    def __init__(self, host: Optional[str] = None):
        self.host = (host or get_ollama_host()).rstrip("/")

    async def list_models(self) -> List[Dict]:
        """获取可用模型列表

        Returns:
            模型列表，每个模型包含 name, size, modified_at 等信息
        """
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(f"{self.host}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                return data.get("models", [])
            except Exception as e:
                raise RuntimeError(f"无法获取模型列表: {e}")

    async def get_model_info(self, model_name: str) -> Dict:
        """获取模型详细信息

        Args:
            model_name: 模型名称

        Returns:
            模型信息，包含 license, modelfile, parameters 等
        """
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(
                    f"{self.host}/api/show",
                    json={"name": model_name}
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                raise RuntimeError(f"无法获取模型信息: {e}")

    def get_thinking_capable_models(self) -> List[str]:
        """返回支持思考过程的模型列表

        基于 Ollama 模型命名约定判断
        """
        return ["qwen3:8b", "deepseek-r1:7b", "deepseek-r1:8b"]
```

- [ ] **Step 2: 更新 config.py 添加 get_ollama_host**

修改文件: `auto_novel/config.py`

```python
import os
from functools import lru_cache

@lru_cache
def get_ollama_host() -> str:
    """获取 Ollama 服务地址"""
    return os.getenv("OLLAMA_HOST", "http://localhost:11434")
```

- [ ] **Step 3: 安装 httpx 依赖**

```bash
pip install httpx
```

- [ ] **Step 4: 提交**

```bash
git add auto_novel/api/ollama.py auto_novel/config.py
git commit -m "feat(api): 添加 Ollama 模型管理模块"
```

---

### Task 2: 添加模型列表 API 端点

**Files:**
- Modify: `auto_novel/api/routes.py`

- [ ] **Step 1: 导入依赖**

在文件顶部添加：

```python
from .ollama import OllamaModelManager
```

- [ ] **Step 2: 添加模型列表端点**

在文件末尾添加：

```python
# ===== 模型管理 =====


@router.get("/models")
async def list_models():
    """获取可用模型列表

    Returns:
        模型列表，包含模型名称、大小等信息
    """
    manager = OllamaModelManager()
    try:
        models = await manager.list_models()
        # 简化返回，只保留必要信息
        return {
            "models": [
                {
                    "name": m.get("name", ""),
                    "size": m.get("size", 0),
                    "modified_at": m.get("modified_at", ""),
                }
                for m in models
            ],
            "total": len(models)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 3: 测试 API**

```bash
curl http://localhost:8000/api/models
```

预期输出：包含可用模型列表的 JSON

- [ ] **Step 4: 提交**

```bash
git add auto_novel/api/routes.py
git commit -m "feat(api): 添加模型列表 API 端点"
```

---

### Task 3: 修改流式输出 API - 区分 thinking 和 response

**Files:**
- Modify: `auto_novel/api/routes.py`
- Modify: `auto_novel/models/ollama_client.py`

- [ ] **Step 1: 修改 OllamaClient.generate_stream 返回结构**

修改 `auto_novel/models/ollama_client.py` 的 `generate_stream` 方法：

```python
async def generate_stream(
    self, prompt: str, system: Optional[str] = None, model: Optional[str] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """流式生成文本

    Args:
        prompt: 输入提示词
        system: 系统提示词
        model: 模型名称，默认使用配置的模型

    Yields:
        包含 content, thinking, done 的字典
    """
    url = f"{self.host}/api/generate"
    payload = {
        "model": model or self.model,
        "prompt": prompt,
        "stream": True
    }
    if system:
        payload["system"] = system

    timeout = aiohttp.ClientTimeout(total=self.config.timeout)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, json=payload) as resp:
            buffer = ""
            async for chunk in resp.content.iter_any():
                if chunk:
                    buffer += chunk.decode("utf-8")
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        if line.strip():
                            try:
                                data = json.loads(line)
                                yield {
                                    "content": data.get("response", ""),
                                    "thinking": data.get("thinking", ""),
                                    "done": data.get("done", False)
                                }
                                if data.get("done"):
                                    return
                            except json.JSONDecodeError:
                                continue
```

同时需要更新导入：

```python
from typing import AsyncGenerator, Optional, Dict, Any
```

- [ ] **Step 2: 修改流式写入 API 端点**

修改 `auto_novel/api/routes.py` 的 `write_stream` 函数：

```python
@router.post("/write/stream")
async def write_stream(request: dict):
    """流式写作接口

    使用 SSE (Server-Sent Events) 返回流式生成的内容
    区分 thinking 和 response
    """
    prompt = request.get("prompt", "")
    system = request.get("system", "你是资深玄幻小说作家。")
    model = request.get("model", None)  # 支持指定模型
    novel_id = request.get("novel_id", "")
    chapter_num = request.get("chapter_num", 1)

    if not prompt:
        raise HTTPException(status_code=400, detail="prompt 不能为空")

    client = OllamaClient()

    async def generate():
        """生成器函数，流式输出内容"""
        try:
            async for chunk in client.generate_stream(prompt, system, model):
                # 分别发送 thinking 和 content
                if chunk.get("thinking"):
                    yield {
                        "event": "thinking",
                        "data": json.dumps({
                            "content": chunk["thinking"],
                            "done": False
                        }, ensure_ascii=False)
                    }
                if chunk.get("content"):
                    yield {
                        "event": "content",
                        "data": json.dumps({
                            "content": chunk["content"],
                            "done": False
                        }, ensure_ascii=False)
                    }
                if chunk.get("done"):
                    yield {
                        "event": "done",
                        "data": json.dumps({
                            "done": True,
                            "novelId": novel_id,
                            "chapterNum": chapter_num
                        }, ensure_ascii=False)
                    }
                    return
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}, ensure_ascii=False)
            }

    return EventSourceResponse(generate())
```

- [ ] **Step 3: 测试流式 API**

```bash
curl -s -X POST http://localhost:8000/api/write/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "你好"}' \
  --no-buffer | head -20
```

预期输出：看到 `event: thinking` 和 `event: content` 两种事件

- [ ] **Step 4: 提交**

```bash
git add auto_novel/api/routes.py auto_novel/models/ollama_client.py
git commit -m "feat(api): 流式输出区分 thinking 和 content"
```

---

## Chunk 2: 前端 - API 客户端和类型定义

### Task 4: 创建 Ollama API 客户端

**Files:**
- Create: `kanban/src/lib/ollama.ts`

- [ ] **Step 1: 创建 API 客户端**

```typescript
/** Ollama API 客户端 */

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface OllamaModelsResponse {
  models: OllamaModel[];
  total: number;
}

export interface StreamWriteRequest {
  prompt: string;
  system?: string;
  model?: string;
  novel_id?: string;
  chapter_num?: number;
}

export interface StreamEventData {
  content: string;
  done: boolean;
  error?: string;
}

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8000/api") {
    this.baseUrl = baseUrl;
  }

  async listModels(): Promise<OllamaModelsResponse> {
    const resp = await fetch(`${this.baseUrl}/models`);
    if (!resp.ok) throw new Error("Failed to fetch models");
    return resp.json();
  }

  /**
   * 流式写作
   * @param request 写作请求
   * @param callbacks 回调函数
   */
  async streamWrite(
    request: StreamWriteRequest,
    callbacks: {
      onThinking?: (content: string) => void;
      onContent?: (content: string) => void;
      onDone?: () => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/write/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!resp.ok) throw new Error("Failed to start stream");

    const reader = resp.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error("No reader");

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 处理 SSE 格式
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          const eventType = line.slice(6).trim();
          continue;
        }

        if (line.startsWith("data: ")) {
          try {
            const data: StreamEventData = JSON.parse(line.slice(6));
            if (data.error) {
              callbacks.onError?.(data.error);
              return;
            }
            if (data.done) {
              callbacks.onDone?.();
              return;
            }
            if (data.content) {
              // 根据事件类型分发（需要追踪上一个 event 类型）
            }
          } catch (e) {
            console.error("Parse error:", e);
          }
        }
      }
    }
  }
}

export const ollamaClient = new OllamaClient();
```

- [ ] **Step 2: 提交**

```bash
git add kanban/src/lib/ollama.ts
git commit -m "feat(frontend): 添加 Ollama API 客户端"
```

---

### Task 5: 重写写作页面 - 完整功能

**Files:**
- Modify: `kanban/src/app/write/page.tsx`

- [ ] **Step 1: 创建增强版写作页面**

```typescript
"use client"

import { useState, useEffect, useRef } from "react"
import { ollamaClient, OllamaModel } from "@/lib/ollama"

type StreamEventType = "thinking" | "content" | "done" | "error" | null

export default function WritePage() {
  // 模型相关
  const [models, setModels] = useState<OllamaModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("qwen3:8b")
  const [modelsLoading, setModelsLoading] = useState(true)

  // 写作相关
  const [prompt, setPrompt] = useState("")
  const [chapterNum, setChapterNum] = useState(1)
  const [isWriting, setIsWriting] = useState(false)

  // 内容相关
  const [thinking, setThinking] = useState("")
  const [content, setContent] = useState("")
  const [showThinking, setShowThinking] = useState(true)

  // 滚动控制
  const contentRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // 加载模型列表
  useEffect(() => {
    ollamaClient.listModels()
      .then(data => {
        setModels(data.models)
        if (data.models.length > 0) {
          setSelectedModel(data.models[0].name)
        }
      })
      .catch(console.error)
      .finally(() => setModelsLoading(false))
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [content, thinking, autoScroll])

  // 检测用户手动滚动
  const handleScroll = () => {
    if (!contentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }

  const startWriting = async () => {
    if (!prompt.trim()) return

    setIsWriting(true)
    setContent("")
    setThinking("")

    try {
      const resp = await fetch("http://localhost:8000/api/write/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          system: "你是资深玄幻小说作家。擅长写修仙题材，风格节奏紧凑。",
          model: selectedModel,
          novel_id: "temp",
          chapter_num: chapterNum,
        }),
      })

      const reader = resp.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error("无法读取响应流")

      let buffer = ""
      let currentEventType: StreamEventType = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          // 处理事件类型
          if (line.startsWith("event:")) {
            currentEventType = line.slice(6).trim() as StreamEventType
            continue
          }

          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.error) {
                setContent(prev => prev + `\n[错误: ${data.error}]`)
                setIsWriting(false)
                return
              }

              if (data.done) {
                setIsWriting(false)
                return
              }

              if (data.content) {
                if (currentEventType === "thinking") {
                  setThinking(prev => prev + data.content)
                } else if (currentEventType === "content") {
                  setContent(prev => prev + data.content)
                }
              }
            } catch (e) {
              console.error("解析错误:", e)
            }
          }
        }
      }
    } catch (error) {
      console.error("写作失败:", error)
      setContent(prev => prev + `\n[错误: ${error}]`)
    } finally {
      setIsWriting(false)
    }
  }

  const examplePrompts = [
    "请写玄幻小说《逆天修仙传》第一章，主角林凡发现一枚龙血丹，与左臂胎记呼应，2000字左右。",
    "林凡在青云宗外门考核中，因灵根低劣被嘲笑，但他不服输，决心用毅力证明自己。",
    "林凡进入后山禁地，意外发现一处古修洞府，里面藏着残缺的修炼功法。",
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">AI 写作</h1>

        {/* 控制面板 */}
        <div className="p-6 mb-6 rounded-lg bg-slate-800 border border-slate-700">
          {/* 模型选择 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              模型
            </label>
            {modelsLoading ? (
              <div className="text-slate-400 text-sm">加载模型中...</div>
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 章节号 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              章节号
            </label>
            <input
              type="number"
              value={chapterNum}
              onChange={(e) => setChapterNum(parseInt(e.target.value) || 1)}
              className="w-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 写作提示 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              写作提示
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入写作提示..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 示例提示 */}
          <div className="mb-4">
            <p className="text-sm text-slate-400 mb-2">示例提示：</p>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(example)}
                  className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                >
                  示例 {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* 开始按钮 */}
          <button
            onClick={startWriting}
            disabled={isWriting || !prompt.trim()}
            className={`w-full py-2 rounded font-medium transition-colors ${
              isWriting || !prompt.trim()
                ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isWriting ? "写作中..." : "开始写作"}
          </button>
        </div>

        {/* 内容显示区域 */}
        {(content || thinking) && (
          <div className="space-y-4">
            {/* 思考过程 */}
            {thinking && showThinking && (
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400">
                    💭 思考过程
                  </h3>
                  <button
                    onClick={() => setShowThinking(false)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    隐藏
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-500 font-sans leading-relaxed">
                  {thinking}
                </pre>
              </div>
            )}

            {/* 正文内容 */}
            <div className="p-6 rounded-lg bg-slate-800 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">生成内容</h2>
                <div className="flex items-center gap-4">
                  {/* 自动滚动开关 */}
                  <label className="flex items-center gap-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="rounded"
                    />
                    自动滚动
                  </label>
                  {/* 字数统计 */}
                  <span className="text-sm text-slate-400">
                    字数: {content.length}
                  </span>
                </div>
              </div>

              {/* 可滚动内容区域 */}
              <div
                ref={contentRef}
                onScroll={handleScroll}
                className="max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
              >
                <pre className="whitespace-pre-wrap text-slate-200 font-sans leading-relaxed">
                  {content || "正在生成..."}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 添加滚动条样式**

修改 `kanban/src/app/globals.css`，添加：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 自定义滚动条 */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  @apply bg-slate-800;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-slate-600 rounded;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  @apply bg-slate-500;
}
```

- [ ] **Step 3: 测试前端**

```bash
cd kanban
npm run dev
```

访问 http://localhost:3000/write

- [ ] **Step 4: 提交**

```bash
git add kanban/src/app/write/page.tsx kanban/src/app/globals.css
git commit -m "feat(frontend): 重写写作页面，支持模型选择、思考显示、滚动控制"
```

---

## Chunk 3: 集成测试和文档

### Task 6: 端到端测试

**Files:**
- Create: `tests/api/test_write_stream.py`

- [ ] **Step 1: 创建测试文件**

```python
"""测试流式写作 API"""

import pytest
import json
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_models(async_client: AsyncClient):
    """测试获取模型列表"""
    resp = await async_client.get("/api/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert "total" in data
    assert isinstance(data["models"], list)


@pytest.mark.asyncio
async def test_write_stream_basic(async_client: AsyncClient):
    """测试基本流式写入"""
    resp = await async_client.post(
        "/api/write/stream",
        json={"prompt": "写一句话"}
    )
    assert resp.status_code == 200

    # 收集所有事件
    events = []
    async for line in resp.aiter_lines():
        if line.startswith("event:"):
            events.append(line[6:].strip())
        elif line.startswith("data:"):
            data = json.loads(line[5:])
            if data.get("done"):
                break

    # 应该有 content 或 thinking 事件
    assert "content" in events or "thinking" in events
```

- [ ] **Step 2: 运行测试**

```bash
pytest tests/api/test_write_stream.py -v
```

- [ ] **Step 3: 提交**

```bash
git add tests/api/test_write_stream.py
git commit -m "test(api): 添加流式写作 API 测试"
```

---

### Task 7: 更新文档

**Files:**
- Modify: `README.md`
- Create: `docs/ai-write-usage.md`

- [ ] **Step 1: 更新 README**

添加 AI 写作功能说明：

````markdown
## AI 写作

访问 http://localhost:3000/write 使用 AI 写作功能。

### 功能
- 模型选择：支持 Ollama 上所有可用模型
- 思考过程显示：支持 thinking 模型的思考过程可见
- 流式输出：实时显示生成内容
- 滚动控制：自动滚动到最新内容，支持手动回滚查看

### 使用
1. 选择模型
2. 输入章节号和写作提示
3. 点击"开始写作"
4. 查看思考过程（可选）和正文内容
````

- [ ] **Step 2: 创建使用文档**

创建 `docs/ai-write-usage.md`：

```markdown
# AI 写作使用指南

## 概述

AI 写作功能基于 Ollama 本地模型，支持流式输出和思考过程显示。

## 支持的模型

### 推荐
- `qwen3:8b` - 支持 thinking，适合创意写作
- `deepseek-r1:7b` - 支持 thinking，逻辑推理强

### 安装模型
```bash
ollama pull qwen3:8b
ollama pull deepseek-r1:7b
```

## API 文档

### 获取模型列表
```
GET /api/models
```

### 流式写作
```
POST /api/write/stream
Content-Type: application/json

{
  "prompt": "写作提示",
  "system": "系统提示（可选）",
  "model": "模型名（可选）",
  "chapter_num": 1
}
```

返回 SSE 事件：
- `event: thinking` - 思考过程
- `event: content` - 正文内容
- `event: done` - 完成标志
- `event: error` - 错误信息
```

- [ ] **Step 3: 提交**

```bash
git add README.md docs/ai-write-usage.md
git commit -m "docs: 添加 AI 写作使用文档"
```

---

## 最终验证

- [ ] **验证检查清单**

1. 后端 API 运行正常 (`python run_api.py`)
2. 前端页面可访问 (`http://localhost:3000/write`)
3. 模型列表正确显示
4. 选择模型后可正常写作
5. thinking 内容正确显示（如 qwen3:8b）
6. 正文内容流式输出
7. 自动滚动功能正常
8. 手动滚动后自动滚动停止
9. 所有测试通过

```bash
pytest tests/api/test_write_stream.py -v
```

- [ ] **最终提交**

```bash
git add .
git commit -m "feat: AI 写作页面增强完成"
```
