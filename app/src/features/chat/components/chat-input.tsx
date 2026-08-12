import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean; // 流式进行中禁用
  /** 受控填充（点击示例问题时填入） */
  draft?: string;
  onDraftConsumed?: () => void;
}

const MAX_ROWS = 6;
const LINE_HEIGHT = 22; // px，与 text-sm leading-relaxed 近似

/**
 * 输入区域：Textarea 自适应高度（1~6 行）+ 发送按钮。
 * 快捷键 Cmd/Ctrl + Enter 发送，普通 Enter 换行。
 */
export function ChatInput({ onSend, disabled, draft, onDraftConsumed }: ChatInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // 自适应高度
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * MAX_ROWS)}px`;
  }, [value]);

  // 示例问题填充
  useEffect(() => {
    if (draft !== undefined) {
      setValue(draft);
      onDraftConsumed?.();
      ref.current?.focus();
    }
  }, [draft, onDraftConsumed]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter 发送
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border p-3">
      <div className="relative">
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="问问助手…"
          disabled={disabled}
          rows={1}
          className="min-h-[40px] resize-none pr-12 text-sm leading-relaxed"
        />
        <Button
          type="button"
          size="icon"
          className="absolute bottom-1.5 right-1.5 h-7 w-7"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="发送"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
        Cmd/Ctrl + Enter 发送
      </p>
    </div>
  );
}
