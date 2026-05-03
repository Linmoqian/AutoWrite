import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Modal,
  message,
} from "antd";
import { createNovel } from "../services/tauri";

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
  const [pendingValues, setPendingValues] = useState<{
    title: string;
    genre: string;
    theme: string;
    chapters: number;
  } | null>(null);

  const doCreate = async (
    values: { title: string; genre: string; theme: string; chapters: number },
    overwrite: boolean,
  ) => {
    setLoading(true);
    try {
      await createNovel(values.title, values.genre, values.theme, values.chapters, overwrite);
      message.success("小说创建成功");
      navigate("/");
    } catch (e: unknown) {
      const msg = String(e);
      if (msg.includes("已有小说")) {
        setPendingValues(values);
      } else {
        message.error(`创建失败: ${e}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: {
    title: string;
    genre: string;
    theme: string;
    chapters: number;
  }) => {
    doCreate(values, false);
  };

  const handleOverwrite = async () => {
    if (!pendingValues) return;
    setPendingValues(null);
    doCreate(pendingValues, true);
  };

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 className="page-title">创建新小说</h1>
      <Card>
        <Form
          layout="vertical"
          initialValues={{ genre: "xuanhuan", theme: "修仙", chapters: 100 }}
          onFinish={onFinish}
          requiredMark={false}
        >
          <Form.Item
            name="title"
            label="小说标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input placeholder="如：逆天剑尊" />
          </Form.Item>
          <Form.Item name="genre" label="类型" rules={[{ required: true }]}>
            <Select options={genreOptions} />
          </Form.Item>
          <Form.Item name="theme" label="主题" rules={[{ required: true }]}>
            <Input placeholder="如：逆天改命、修仙" />
          </Form.Item>
          <Form.Item
            name="chapters"
            label="目标章节数"
            rules={[{ required: true }]}
          >
            <InputNumber min={10} max={1000} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              开始创作
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        open={!!pendingValues}
        title="目录下已有小说"
        okText="覆盖并创建"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onOk={handleOverwrite}
        onCancel={() => setPendingValues(null)}
      >
        <p>当前目录下已经存在小说，覆盖后将丢失所有已有内容（大纲、章节、记忆等）。</p>
        <p>建议先在设置中选择一个新目录，再创建新小说。</p>
      </Modal>
    </div>
  );
}
