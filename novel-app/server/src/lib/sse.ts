// SSE 广播器：单一 /events 流复用推送所有进度事件。
// 前端用 EventSource 连接，收到 {type, payload} 结构的消息。
// 对应 Tauri 的 app.emit() + 前端 listen()，但 Tauri 按事件名分发，
// 这里用 type 字段统一路由（type = "outline-progress" | "chapter-progress" | "image-progress" | "outline-generation-status"）。

type SseMessage = { type: string; payload: unknown };

type Listener = (msg: SseMessage) => void;

class SseBroadcaster {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // 发布消息到所有订阅者
  publish(msg: SseMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(msg);
      } catch {
        // 单个监听器异常不影响其他
      }
    }
  }
}

// 进程级单例
export const sse = new SseBroadcaster();

// 便捷发布函数，与 Tauri 事件名一一对应
export function emitOutlineProgress(payload: {
  step: string;
  chunk: string;
  done: boolean;
}): void {
  sse.publish({ type: "outline-progress", payload });
}

export function emitChapterProgress(payload: {
  chunk: string;
  done: boolean;
}): void {
  sse.publish({ type: "chapter-progress", payload });
}

export function emitImageProgress(payload: {
  stage: string;
  message: string;
  imageId?: string;
}): void {
  sse.publish({ type: "image-progress", payload });
}

export function emitOutlineGenerationStatus(payload: unknown): void {
  sse.publish({ type: "outline-generation-status", payload });
}
