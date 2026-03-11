/**
 * Ollama API 客户端
 *
 * 提供与 Ollama 服务的通信接口，包括模型列表查询和流式写作功能。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// =============================================================================
// 类型定义
// =============================================================================

/** Ollama 模型信息 */
export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
}

/** 模型列表响应 */
export interface OllamaModelListResponse {
  models: OllamaModel[];
  total: number;
}

/** 健康检查响应 */
export interface OllamaHealthResponse {
  healthy: boolean;
  host: string;
}

/** 流式写作请求参数 */
export interface StreamWriteRequest {
  prompt: string;
  system?: string;
  novelId: string;
  chapterNum: number;
}

/** 流式事件回调 */
export interface StreamWriteCallbacks {
  /** 思考过程回调 */
  onThinking?: (content: string) => void;
  /** 生成内容回调 */
  onContent?: (content: string) => void;
  /** 完成回调 */
  onDone?: (data: { novelId: string; chapterNum: number }) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

/** SSE 事件数据 */
interface SSEEventData {
  event: string;
  data: string;
}

// =============================================================================
// OllamaClient 类
// =============================================================================

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE;
  }

  /**
   * 获取 Ollama 模型列表
   *
   * @returns 模型列表
   * @throws Error 当请求失败时抛出错误
   */
  async listModels(): Promise<OllamaModel[]> {
    const url = `${this.baseUrl}/ollama/models`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '请求失败' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const data: OllamaModelListResponse = await response.json();
      return data.models;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('获取模型列表失败');
    }
  }

  /**
   * 获取支持思考的模型列表
   *
   * @returns 支持思考的模型列表
   * @throws Error 当请求失败时抛出错误
   */
  async listThinkingModels(): Promise<OllamaModel[]> {
    const url = `${this.baseUrl}/ollama/models/thinking`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '请求失败' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const data: OllamaModelListResponse = await response.json();
      return data.models;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('获取支持思考的模型列表失败');
    }
  }

  /**
   * 检查 Ollama 服务健康状态
   *
   * @returns 健康状态信息
   */
  async checkHealth(): Promise<OllamaHealthResponse> {
    const url = `${this.baseUrl}/ollama/health`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '请求失败' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('健康检查失败');
    }
  }

  /**
   * 流式写作
   *
   * 使用 SSE (Server-Sent Events) 进行流式生成。
   *
   * @param request 写作请求参数
   * @param callbacks 事件回调函数
   * @returns 中断函数，调用可停止流式传输
   *
   * @example
   * ```ts
   * const client = new OllamaClient();
   * const stop = client.streamWrite(
   *   { prompt: '写一章', novelId: '123', chapterNum: 1 },
   *   {
   *     onThinking: (text) => console.log('思考:', text),
   *     onContent: (text) => console.log('内容:', text),
   *     onDone: (data) => console.log('完成:', data),
   *     onError: (err) => console.error('错误:', err),
   *   }
   * );
   * ```
   */
  streamWrite(request: StreamWriteRequest, callbacks: StreamWriteCallbacks): () => void {
    const url = `${this.baseUrl}/write/stream`;
    const controller = new AbortController();

    // 启动流式请求
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        system: request.system || '你是资深玄幻小说作家。',
        novel_id: request.novelId,
        chapter_num: request.chapterNum,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: '请求失败' }));
          callbacks.onError?.(error.detail || `HTTP ${response.status}`);
          return;
        }

        if (!response.body) {
          callbacks.onError?.('响应体为空');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // 解码接收到的数据块
            buffer += decoder.decode(value, { stream: true });

            // 处理 SSE 格式数据 - 按双换行分割事件
            const rawEvents = buffer.split(/\n\n/);
            buffer = rawEvents.pop() || ''; // 保留最后一个可能不完整的事件

            for (const rawEvent of rawEvents) {
              if (!rawEvent.trim()) continue;

              const lines = rawEvent.split('\n').filter(l => l.trim());
              const events = this.parseSSE(lines);

              for (const event of events) {
                this.handleSSEEvent(event, callbacks);
              }
            }
          }

          // 处理缓冲区中剩余的数据
          if (buffer.trim()) {
            const lines = buffer.split('\n').filter(l => l.trim());
            const events = this.parseSSE(lines);
            for (const event of events) {
              this.handleSSEEvent(event, callbacks);
            }
          }
        } catch (err) {
          // 读取过程中可能因为 AbortError 被中断
          if (err instanceof Error && err.name !== 'AbortError') {
            callbacks.onError?.(err.message);
          }
        }
      })
      .catch((err) => {
        // 网络错误或请求被中止
        if (err instanceof Error && err.name !== 'AbortError') {
          callbacks.onError?.(err.message);
        }
      });

    // 返回中断函数
    return () => controller.abort();
  }

  /**
   * 解析 SSE 数据流
   *
   * @param lines SSE 数据行数组
   * @returns 解析后的事件数据列表
   */
  private parseSSE(lines: string[]): SSEEventData[] {
    const events: SSEEventData[] = [];
    let currentEvent: string | null = null;
    let currentData: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // 空行表示一个事件结束
      if (!trimmed) {
        if (currentEvent && currentData.length > 0) {
          events.push({
            event: currentEvent,
            data: currentData.join('\n'),
          });
        }
        currentEvent = null;
        currentData = [];
        continue;
      }

      // 解析 event 行
      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.replace(/^event:\s*/, '');
        continue;
      }

      // 解析 data 行
      if (trimmed.startsWith('data:')) {
        currentData.push(trimmed.replace(/^data:\s*/, ''));
        continue;
      }
    }

    // 处理最后一个事件
    if (currentEvent && currentData.length > 0) {
      events.push({
        event: currentEvent,
        data: currentData.join('\n'),
      });
    }

    return events;
  }

  /**
   * 处理 SSE 事件
   *
   * @param event SSE 事件数据
   * @param callbacks 回调函数集合
   */
  private handleSSEEvent(event: SSEEventData, callbacks: StreamWriteCallbacks): void {
    const { event: eventType, data } = event;

    try {
      const parsedData = JSON.parse(data);

      switch (eventType) {
        case 'thinking':
          callbacks.onThinking?.(parsedData.content || '');
          break;
        case 'content':
          callbacks.onContent?.(parsedData.content || '');
          break;
        case 'done':
          callbacks.onDone?.({
            novelId: parsedData.novelId || '',
            chapterNum: parsedData.chapterNum || 0,
          });
          break;
        case 'error':
          callbacks.onError?.(parsedData.error || '未知错误');
          break;
      }
    } catch (error) {
      // JSON 解析失败，尝试直接使用 data
      if (eventType === 'content') {
        callbacks.onContent?.(data);
      } else if (eventType === 'thinking') {
        callbacks.onThinking?.(data);
      }
    }
  }
}

// =============================================================================
// 导出默认实例
// =============================================================================

export const ollamaClient = new OllamaClient();

export default ollamaClient;
