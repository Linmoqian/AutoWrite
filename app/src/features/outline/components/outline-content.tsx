import { filterThinkTags } from "@/lib/filter-think-tags";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { OutlineStep } from "@/types";

export function OutlineContent({
  activeTab,
  world,
  characters,
  volumes,
}: {
  activeTab: OutlineStep;
  world?: string;
  characters?: string;
  volumes: { title: string; chapters: { number: number; title: string; summary: string }[] }[];
}) {
  if (activeTab === "worldView" && world) {
    return (
      <div className="md-body">
        <Markdown remarkPlugins={[remarkGfm]}>{filterThinkTags(world)}</Markdown>
      </div>
    );
  }
  if (activeTab === "characters" && characters) {
    return (
      <div className="md-body">
        <Markdown remarkPlugins={[remarkGfm]}>{filterThinkTags(characters)}</Markdown>
      </div>
    );
  }
  if (activeTab === "outline" && volumes.length > 0) {
    return (
      <div className="space-y-3">
        {volumes.map((vol, idx) => (
          <div key={idx}>
            <div className="mb-1.5 font-medium text-foreground">{vol.title}</div>
            <div className="space-y-1 pl-4">
              {vol.chapters.map((ch) => (
                <div key={ch.number} className="text-sm text-muted-foreground">
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {String(ch.number).padStart(3, "0")}.
                  </span>{" "}
                  {ch.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-muted-foreground">暂无内容</p>;
}
