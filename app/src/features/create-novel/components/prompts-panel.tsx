import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Prompts } from "@/types";

const PROMPT_FIELDS: { key: keyof Prompts; label: string }[] = [
  { key: "worldView", label: "世界观提示词" },
  { key: "characters", label: "角色提示词" },
  { key: "outline", label: "大纲提示词" },
  { key: "chapter", label: "章节提示词" },
];

function PromptField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function PromptsPanel({
  prompts,
  open,
  onOpenChange,
  onChange,
}: {
  prompts: Prompts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (prompts: Prompts) => void;
}) {
  return (
    <Card className="mt-4">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between p-4 text-left">
            <span className="text-sm font-medium text-foreground">
              提示词模板（高级，可选自定义）
            </span>
            <span className="text-xs text-muted-foreground">
              {open ? "收起" : "展开"}
            </span>
          </button>
        </CollapsibleTrigger>
        <Separator />
        <CollapsibleContent>
          <div className="space-y-4 p-4">
            {PROMPT_FIELDS.map((field) => (
              <PromptField
                key={field.key}
                label={field.label}
                value={prompts[field.key]}
                onChange={(v) => onChange({ ...prompts, [field.key]: v })}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
