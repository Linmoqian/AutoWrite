import { Card, Typography } from "antd";
import type { ChapterMeta } from "../types";

const { Text } = Typography;

interface ChapterCardProps {
  chapter: ChapterMeta;
  selected?: boolean;
  onClick?: () => void;
}

export default function ChapterCard({ chapter, selected, onClick }: ChapterCardProps) {
  return (
    <Card
      size="small"
      hoverable
      style={selected ? { borderLeft: "3px solid #1890ff" } : undefined}
      onClick={onClick}
    >
      <Text strong>第{chapter.chapter}章</Text>
      <Text> {chapter.title}</Text>
      <br />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {chapter.words} 字 | {chapter.created}
      </Text>
    </Card>
  );
}
