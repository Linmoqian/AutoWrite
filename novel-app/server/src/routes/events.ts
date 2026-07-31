// SSE 事件流：GET /events
// 复用 sse 广播器，把 {type, payload} 序列化为 SSE 帧。
// 前端用 EventSource 连接，按 type 分发到各 handler。

import type { FastifyInstance, FastifyReply } from "fastify";

import { sse } from "../lib/sse.js";

export function registerEventsRoute(app: FastifyInstance): void {
  app.get("/events", (req, reply: FastifyReply) => {
    // SSE 头
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // 立即发一帧避免前端长时间等待 header
    reply.raw.write(": connected\n\n");

    const unsubscribe = sse.subscribe((msg) => {
      reply.raw.write(`data: ${JSON.stringify(msg)}\n\n`);
    });

    // 连接关闭时取消订阅
    req.raw.on("close", () => {
      unsubscribe();
    });
  });
}
