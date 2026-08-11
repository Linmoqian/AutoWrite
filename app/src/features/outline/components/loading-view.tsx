import { Check, Loader2 } from "lucide-react";
import { OUTLINE_STEPS, OUTLINE_STEP_LABELS } from "@/lib/constants";
import { filterThinkTags } from "@/lib/filter-think-tags";
import { Card, CardContent } from "@/components/ui/card";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { OutlineStep } from "@/types";

type StreamingText = Partial<Record<OutlineStep, string>>;

export function LoadingView({
  currentStep,
  streamingText,
  streamRef,
}: {
  currentStep: OutlineStep | null;
  streamingText: StreamingText;
  streamRef: React.RefObject<HTMLDivElement | null>;
}) {
  const stepIndex = currentStep ? OUTLINE_STEPS.indexOf(currentStep) : 0;
  const displayText = currentStep
    ? filterThinkTags(streamingText[currentStep] || "")
    : "";

  return (
    <div className="fade-in">
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {OUTLINE_STEPS.map((key, i) => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {i < stepIndex ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : i === stepIndex ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border" />
                  )}
                  <span
                    className={
                      i === stepIndex
                        ? "text-sm font-medium text-foreground"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {OUTLINE_STEP_LABELS[key]}
                  </span>
                </div>
                {i < OUTLINE_STEPS.length - 1 && (
                  <div className="h-px w-8 bg-border" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {displayText ? (
        <div ref={streamRef} className="max-h-[60vh] overflow-y-auto">
          <div className="md-body">
            <Markdown remarkPlugins={[remarkGfm]}>{displayText}</Markdown>
            <span className="cursor-blink">|</span>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            正在连接模型...
          </CardContent>
        </Card>
      )}
    </div>
  );
}
