import { useEffect, useRef } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

/**
 * 通用的 Tauri 事件订阅 hook。
 * 在组件挂载时订阅事件，卸载时自动清理。
 */
export function useTauriEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      if (cancelled) return;
      unlisten = await listen<T>(eventName, (e) => {
        handlerRef.current(e.payload);
      });
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [eventName, enabled]);
}
