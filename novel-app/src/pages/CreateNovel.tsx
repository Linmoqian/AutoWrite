import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, InputNumber, Select, Button, Card, Typography, message } from "antd";
import { createNovel } from "../services/tauri";

const { Title } = Typography;

const genreOptions = [
  { value: "xuanhuan", label: "玄幻" },
  { value: "qihuan", label: "奇幻" },
  { value: "wuxia", label: "武侠" },
  { value: "xianxia", label: "仙侠" },
  { value: "dushi", label: "都市" },
  { value: "kehuan", label: "科幻" },
  { value: "lishi", label: "历史" },
  { value: "youxi", label: "游戏" },
];

export default function CreateNovel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { title: string; genre: string; theme: string; chapters: number }) => {
    setLoading(true);
    try {
      await createNovel(values.title, values.genre, values.theme, values.chapters);
      message.success("小说创建成功");
      navigate("/");
    } catch (e) {
      message.error(`创建失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Title level={3}>创建新小说</Title>
      <Card>
        <Form
          layout="vertical"
          initialValues={{ genre: "xuanhuan", theme: "修仙", chapters: 100 }}
          onFinish={onFinish}
        >
          <Form.Item name="title" label="小说标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="如：逆天剑尊" />
          </Form.Item>
          <Form.Item name="genre" label="类型" rules={[{ required: true }]}>
            <Select options={genreOptions} />
          </Form.Item>
          <Form.Item name="theme" label="主题" rules={[{ required: true }]}>
            <Input placeholder="如：逆天改命、修仙" />
          </Form.Item>
          <Form.Item name="chapters" label="目标章节数" rules={[{ required: true }]}>
            <InputNumber min={10} max={1000} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
