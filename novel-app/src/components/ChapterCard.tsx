import { Typography } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import type { ChapterMeta } from "../types";

const { Text } = Typography;

interface ChapterCardProps {
  chapter: ChapterMeta;
  selected?: boolean;
  generating?: boolean;
  onClick?: () => void;
}

export default function ChapterCard({
  chapter,
  selected,
  generating,
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
        borderColor: generating
          ? "var(--gold)"
          : selected
            ? "var(--gold-dim)"
            : "var(--border)",
        background: generating
          ? "var(--gold-glow)"
          : selected
            ? "var(--gold-glow)"
            : "var(--bg-surface)",
        transition: "all 0.2s ease",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text strong style={{ color: selected || generating ? "var(--gold)" : "var(--text-primary)", whiteSpace: "nowrap" }}>
          {String(chapter.chapter).padStart(3, "0")}
        </Text>
        <Text style={{ color: "var(--text-secondary)", marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {chapter.title}
        </Text>
      </div>
      <div style={{ marginTop: 4 }}>
        {generating ? (
          <Text style={{ fontSize: 12, color: "var(--gold)" }}>
            <LoadingOutlined style={{ marginRight: 4 }} />
            创作中
          </Text>
        ) : (
          <Text style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {chapter.words} 字
          </Text>
        )}
      </div>
    </div>
  );
}
