import { cn } from "@/lib/utils";
import type { ExportFormat } from "@/types";
import { EXPORT_FORMATS } from "../formats";

export function FormatPicker({
  selected,
  onSelect,
}: {
  selected: ExportFormat | null;
  onSelect: (format: ExportFormat) => void;
}) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {EXPORT_FORMATS.map((fmt) => {
        const active = selected === fmt.key;
        const Icon = fmt.icon;
        return (
          <button
            key={fmt.key}
            onClick={() => onSelect(fmt.key)}
            className={cn(
              "flex items-center gap-3.5 rounded-lg border-2 p-4 text-left transition-colors",
              active
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30"
            )}
          >
            <div
              className={cn(
                "transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div
                className={cn(
                  "font-medium",
                  active ? "text-primary" : "text-foreground"
                )}
              >
                {fmt.label}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {fmt.desc}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
