import { useNavigate } from "react-router-dom";
import {
  Card,
  Statistic,
  Progress,
  Button,
  Empty,
  Space,
  Typography,
  Collapse,
} from "antd";
import { BookOutlined, FileTextOutlined } from "@ant-design/icons";
import { useApp } from "../contexts/AppContext";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const { Paragraph, Text } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const { novelStatus: status } = useApp();

  if (!status) {
    return <Empty description="请先选择小说目录并创建小说" />;
  }

  const { novel, context, total_chapters, written_chapters } = status;
  const progressPercent =
    total_chapters > 0
      ? Math.round((written_chapters / total_chapters) * 100)
      : 0;

  return (
    <div className="fade-in">
      <h1 className="page-title">{novel.title}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Card>
          <Statistic
            title="类型"
            value={novel.genre}
            prefix={<BookOutlined />}
          />
        </Card>
        <Card>
          <Statistic title="主题" value={novel.theme} />
        </Card>
        <Card>
          <Statistic
            title="目标章节"
            value={novel.target_chapters}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 13,
            marginBottom: 10,
          }}
        >
          创作进度
        </div>
        <Progress
          percent={progressPercent}
          status={progressPercent === 100 ? "success" : "active"}
          format={() => `${written_chapters} / ${total_chapters} 章`}
        />
      </Card>

      {context.recent_summaries.length > 0 && (
        <Card
          title="最近剧情摘要"
          style={{ marginTop: 16 }}
        >
          {context.recent_summaries.map((s, i) => (
            <Paragraph key={i} style={{ marginBottom: 8, color: "var(--text-secondary)" }}>
              {s}
            </Paragraph>
          ))}
        </Card>
      )}

      {novel.world && (
        <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          <Collapse
            ghost
            items={[{
              key: "world",
              label: <Text strong style={{ fontSize: 15 }}>世界观</Text>,
              children: <div className="md-body"><Markdown remarkPlugins={[remarkGfm]}>{novel.world}</Markdown></div>,
            }]}
            style={{ border: "none" }}
          />
        </Card>
      )}

      {novel.characters && (
        <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          <Collapse
            ghost
            items={[{
              key: "characters",
              label: <Text strong style={{ fontSize: 15 }}>角色</Text>,
              children: <div className="md-body"><Markdown remarkPlugins={[remarkGfm]}>{novel.characters}</Markdown></div>,
            }]}
            style={{ border: "none" }}
          />
        </Card>
      )}

      <Space style={{ marginTop: 20 }}>
        <Button onClick={() => navigate("/outline")}>查看大纲</Button>
        <Button onClick={() => navigate("/chapters")}>查看章节</Button>
      </Space>
    </div>
  );
}
