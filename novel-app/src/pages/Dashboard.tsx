import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Col, Row, Statistic, Progress, Button, Typography, Empty, Space } from "antd";
import { BookOutlined, ThunderboltOutlined, FileTextOutlined } from "@ant-design/icons";
import { getStatus, generateOutline, generateChapter } from "../services/tauri";
import type { NovelStatus } from "../types";
import LoadingButton from "../components/LoadingButton";

const { Title, Paragraph } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<NovelStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const s = await getStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => { refresh(); }, []);

  if (error) {
    return (
      <Empty description={error}>
        <Button onClick={refresh}>重试</Button>
      </Empty>
    );
  }

  if (!status) {
    return <Empty description="请先选择小说目录并创建小说" />;
  }

  const { novel, context, total_chapters, written_chapters } = status;
  const progressPercent = total_chapters > 0
    ? Math.round((written_chapters / total_chapters) * 100)
    : 0;

  return (
    <div>
      <Title level={3}>{novel.title}</Title>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic title="类型" value={novel.genre} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="主题" value={novel.theme} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="目标章节" value={novel.target_chapters} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }}>
        <Title level={5}>创作进度</Title>
        <Progress
          percent={progressPercent}
          status={progressPercent === 100 ? "success" : "active"}
          format={() => `${written_chapters} / ${total_chapters} 章`}
        />
      </Card>

      {context.recent_summaries.length > 0 && (
        <Card title="最近剧情摘要" style={{ marginTop: 16 }}>
          {context.recent_summaries.map((s, i) => (
            <Paragraph key={i} style={{ marginBottom: 8 }}>{s}</Paragraph>
          ))}
        </Card>
      )}

      <Space style={{ marginTop: 16 }}>
        <LoadingButton
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={loading === "outline"}
          onClick={async () => { setLoading("outline"); try { await generateOutline(); } finally { setLoading(null); refresh(); } }}
        >
          生成大纲
        </LoadingButton>
        <LoadingButton
          type="primary"
          icon={<FileTextOutlined />}
          loading={loading === "chapter"}
          onClick={async () => { setLoading("chapter"); try { await generateChapter(); } finally { setLoading(null); refresh(); } }}
        >
          写下一章
        </LoadingButton>
        <Button onClick={() => navigate("/outline")}>查看大纲</Button>
        <Button onClick={() => navigate("/chapters")}>查看章节</Button>
      </Space>
    </div>
  );
}
