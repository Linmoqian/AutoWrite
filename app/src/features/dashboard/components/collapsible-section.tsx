import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { filterThinkTags } from "@/lib/filter-think-tags";

export function CollapsibleSection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mt-4">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between p-4 text-left">
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">
              {open ? "收起" : "展开"}
            </span>
          </button>
        </CollapsibleTrigger>
        <Separator />
        <CollapsibleContent>
          <div className="md-body p-4">
            <Markdown remarkPlugins={[remarkGfm]}>
              {filterThinkTags(content)}
            </Markdown>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
