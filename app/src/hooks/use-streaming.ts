import { useRef, useCallback, useEffect } from "react";

/**
 * 流式生成通用 hook。
 * 管理：streamingText 自动滚动、用户滚动检测、buffer 刷新。
 * 返回 ref 绑定到滚动容器。
 */
export function useStreaming(
  streamingText: string,
  isGenerating: boolean,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // 检测用户是否手动滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledRef.current = !atBottom;
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [isGenerating]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current && !userScrolledRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      userScrolledRef.current = false;
    }
  }, []);

  const resetScroll = useCallback(() => {
    userScrolledRef.current = false;
  }, []);

  return {
    scrollRef,
    userScrolled: userScrolledRef,
    scrollToBottom,
    resetScroll,
    enabled,
  };
}
