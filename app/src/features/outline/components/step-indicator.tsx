import { OUTLINE_STEPS, OUTLINE_STEP_LABELS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import type { OutlineStep } from "@/types";

export function StepIndicator({
  activeTab,
  availableSteps,
  onTabChange,
}: {
  activeTab: OutlineStep;
  availableSteps: readonly OutlineStep[];
  onTabChange: (step: OutlineStep) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {OUTLINE_STEPS.map((key, i) => {
            const available = availableSteps.includes(key);
            const active = activeTab === key;
            return (
              <div key={key} className="flex items-center gap-2">
                <button
                  disabled={!available}
                  onClick={() => onTabChange(key)}
                  className={
                    active
                      ? "text-sm font-medium text-primary"
                      : available
                        ? "text-sm text-muted-foreground hover:text-foreground"
                        : "cursor-not-allowed text-sm text-muted-foreground/40"
                  }
                >
                  <span className="mr-1.5">{i + 1}.</span>
                  {OUTLINE_STEP_LABELS[key]}
                </button>
                {i < OUTLINE_STEPS.length - 1 && (
                  <div className="h-px w-8 bg-border" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
