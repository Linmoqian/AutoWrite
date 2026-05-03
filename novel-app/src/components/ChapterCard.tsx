import { Typography } from "antd";
import type { ChapterMeta } from "../types";

const { Text } = Typography;

interface ChapterCardProps {
  chapter: ChapterMeta;
  selected?: boolean;
  onClick?: () => void;
}

export default function ChapterCard({
  chapter,
  selected,
  onClick,
}: ChapterCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        borderRadius: "var(--radius-md)",
        border: "1px solid",
        borderColor: selected ? "var(--gold-dim)" : "var(--border)",
        background: selected ? "var(--gold-glow)" : "var(--bg-surface)",
        transition: "all 0.2s ease",
      }}
    >
      <div>
        <Text
          strong
          style={{ color: selected ? "var(--gold)" : "var(--text-primary)" }}
        >
          第{chapter.chapter}章
        </Text>
        <Text style={{ color: "var(--text-secondary)", marginLeft: 6 }}>
          {chapter.title}
        </Text>
      </div>
      <Text
        type="secondary"
        style={{ fontSize: 12, color: "var(--text-muted)" }}
      >
        {chapter.words} 字 | {chapter.created}
      </Text>
    </div>
  );
}
