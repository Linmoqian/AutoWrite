"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Loader2, ChevronDown, ChevronUp } from "lucide-react"

// ============================================================================
// 类型定义
// ============================================================================

interface OllamaModel {
  name: string
  size: number
  digest: string
  modifiedAt: string
}

interface WriteRequest {
  prompt: string
  system?: string
  novel_id: string
  chapter_num: number
  model?: string
}

interface SSEChunk {
  thinking?: string
  content?: string
  done?: boolean
  error?: string
}

// ============================================================================
// 类型定义
// ============================================================================

interface OllamaModel {
  name: string
  size: number
  digest: string
  modifiedAt: string
}

interface WriteRequest {
  prompt: string
  system?: string
  novel_id: string
  chapter_num: number
  model?: string
}

interface SSEChunk {
  thinking?: string
  content?: string
  done?: boolean
  error?: string
}

// ============================================================================
// 主组件
// ============================================================================

export default function WritePage() {
  // 状态管理
  const [models, setModels] = useState<OllamaModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [prompt, setPrompt] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("你是资深玄幻小说作家。擅长写修仙题材，风格节奏紧凑。")
  const [thinking, setThinking] = useState("")
  const [content, setContent] = useState("")
  const [isWriting, setIsWriting] = useState(false)
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [chapterNum, setChapterNum] = useState(1)

  // 引用
  const isUserScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ============================================================================
  // API 调用
  // ============================================================================

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchModels = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/ollama/models`)
      if (!response.ok) throw new Error("获取模型列表失败")
      const data = await response.json()
      setModels(data.models || [])
      if (data.models && data.models.length > 0) {
        setSelectedModel(data.models[0].name)
      }
    } catch (error) {
      console.error("获取模型列表失败:", error)
    }
  }, [API_BASE])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  // ============================================================================
  // 页面滚动控制
  // ============================================================================

  const scrollToBottom = useCallback(() => {
    if (autoScroll && !isUserScrollingRef.current) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    }
  }, [autoScroll])

  useEffect(() => {
    scrollToBottom()
  }, [content, thinking, scrollToBottom])

  useEffect(() => {
    const handleWindowScroll = () => {
      const scrollY = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight
      const innerHeight = window.innerHeight
      const isAtBottom = scrollHeight - scrollY - innerHeight < 100

      if (!isAtBottom && autoScroll) {
        isUserScrollingRef.current = true
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        scrollTimeoutRef.current = setTimeout(() => {
          isUserScrollingRef.current = false
        }, 2000)
      }
    }

    window.addEventListener("scroll", handleWindowScroll)
    return () => {
      window.removeEventListener("scroll", handleWindowScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [autoScroll])

  // ============================================================================
  // 写作逻辑
  // ============================================================================

  const startWriting = async () => {
    if (!prompt.trim()) return

    setIsWriting(true)
    setContent("")
    setThinking("")

    try {
      const response = await fetch(`${API_BASE}/api/write/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          system: systemPrompt,
          novel_id: "temp",
          chapter_num: chapterNum,
          model: selectedModel,
        } as WriteRequest),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("无法读取响应流")
      }

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 处理 SSE 格式
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: SSEChunk = JSON.parse(line.slice(6))

              if (data.error) {
                setContent((prev) => prev + `\n[错误: ${data.error}]`)
                setIsWriting(false)
                return
              }

              if (data.thinking) {
                setThinking((prev) => prev + data.thinking)
              }

              if (data.content) {
                setContent((prev) => prev + data.content)
              }

              if (data.done) {
                setIsWriting(false)
                return
              }
            } catch (e) {
              console.error("解析错误:", e)
            }
          }
        }
      }
    } catch (error) {
      console.error("写作失败:", error)
      setContent(`错误: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsWriting(false)
    }
  }

  // ============================================================================
  // 示例提示
  // ============================================================================

  const examplePrompts = [
    "请写玄幻小说《逆天修仙传》第一章，主角林凡发现一枚龙血丹，与左臂胎记呼应，2000字左右。",
    "林凡在青云宗外门考核中，因灵根低劣被嘲笑，但他不服输，决心用毅力证明自己。",
    "林凡进入后山禁地，意外发现一处古修洞府，里面藏着残缺的修炼功法。",
  ]

  // ============================================================================
  // 渲染
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <h1 className="text-3xl font-bold text-white mb-8 flex items-center gap-2">
          <span className="text-red-500">墨</span>
          AI 写作
        </h1>

        {/* 配置面板 */}
        <div className="p-6 mb-6 rounded-lg bg-slate-800/80 border border-slate-700 backdrop-blur-sm">
          {/* 模型选择 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ollama 模型
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isWriting || models.length === 0}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {models.length === 0 ? (
                <option value="">加载中...</option>
              ) : (
                models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))
              )}
            </select>
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
              disabled={isWriting}
              className="w-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            />
          </div>

          {/* 系统提示 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              系统提示
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={isWriting}
              placeholder="设置系统提示..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 resize-none"
            />
          </div>

          {/* 用户提示 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              写作提示
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isWriting}
              placeholder="请输入写作提示..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 resize-none"
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
                  disabled={isWriting}
                  className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors disabled:opacity-50"
                >
                  示例 {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* 开始按钮 */}
          <button
            onClick={startWriting}
            disabled={isWriting || !prompt.trim() || !selectedModel}
            className={`w-full py-3 rounded-lg font-medium transition-all ${
              isWriting || !prompt.trim() || !selectedModel
                ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-900/50"
            }`}
          >
            {isWriting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                写作中...
              </span>
            ) : (
              "开始写作"
            )}
          </button>
        </div>

        {/* 思考过程区域 */}
        {thinking && (
          <div className="mb-6 rounded-lg bg-slate-800/60 border border-amber-900/30 backdrop-blur-sm overflow-hidden">
            <button
              onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between text-amber-300 hover:bg-slate-700/50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                思考过程
              </span>
              {isThinkingExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {isThinkingExpanded && (
              <div className="p-4 border-t border-amber-900/20">
                <pre className="whitespace-pre-wrap text-amber-200/80 text-sm font-mono leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                  {thinking}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* 内容区域 */}
        {content && (
          <div className="p-6 rounded-lg bg-slate-800/80 border border-slate-700 backdrop-blur-sm">
            {/* 头部工具栏 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">生成内容</h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">
                  字数: {content.length}
                </span>
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition-colors ${
                    autoScroll
                      ? "bg-red-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                  title={autoScroll ? "点击关闭自动滚动" : "点击开启自动滚动"}
                >
                  {autoScroll ? "自动滚动中" : "已暂停滚动"}
                </button>
                {!autoScroll && (
                  <button
                    onClick={() => {
                      isUserScrollingRef.current = false
                      scrollToBottom()
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors"
                  >
                    滚到底部
                  </button>
                )}
              </div>
            </div>

            {/* 内容显示区 - 全页面滚动，无固定高度 */}
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <pre className="whitespace-pre-wrap text-slate-200 font-sans leading-relaxed">
                {content}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
