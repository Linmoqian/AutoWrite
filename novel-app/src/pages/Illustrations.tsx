import { Card, Empty } from "antd";
import { PictureOutlined } from "@ant-design/icons";

export default function Illustrations() {
  return (
    <div className="fade-in">
      <h2 className="page-title">小说配图</h2>

      <Card styles={{ body: { padding: "48px 24px" } }}>
        <Empty
          image={<PictureOutlined style={{ fontSize: 56, color: "var(--gold)" }} />}
          description="后续将在这里管理章节配图"
        />
      </Card>
    </div>
  );
}
