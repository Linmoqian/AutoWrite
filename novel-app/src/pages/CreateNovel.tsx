import { useState, useEffect } from "react";
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
  Tag,
  Progress,
  Collapse,
} from "antd";
import { createNovel, getStatus, loadConfig } from "../services/tauri";
import type { NovelStatus, Prompts } from "../types";

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

  const [existingNovel, setExistingNovel] = useState<NovelStatus | null>(null);
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [promptsExpanded, setPromptsExpanded] = useState(false);

  useEffect(() => {
    getStatus()
      .then((s) => setExistingNovel(s))
      .catch(() => setExistingNovel(null));
    loadConfig().then((c) => setPrompts(c.prompts));
  }, []);

  const doCreate = async (
    values: { title: string; genre: string; theme: string; chapters: number },
    overwrite: boolean,
  ) => {
    setLoading(true);
    try {
      await createNovel(
        values.title,
        values.genre,
        values.theme,
        values.chapters,
        overwrite,
        promptsExpanded ? prompts ?? undefined : undefined,
      );
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
      {existingNovel && (
        <Card
          hoverable
          style={{ marginBottom: 16, cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 16 }}>
                {existingNovel.novel.title}
              </span>
              <Tag color="gold" style={{ marginLeft: 8 }}>
                {existingNovel.novel.genre}
              </Tag>
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              {existingNovel.novel.theme}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Progress
              percent={Math.round(
                existingNovel.total_chapters > 0
                  ? (existingNovel.written_chapters / existingNovel.total_chapters) * 100
                  : 0,
              )}
              size="small"
              format={() =>
                `${existingNovel.written_chapters} / ${existingNovel.total_chapters} 章`
              }
            />
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
            点击查看详情
          </div>
        </Card>
      )}
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

      {prompts && (
        <Card style={{ marginTop: 16 }}>
          <Collapse
            activeKey={promptsExpanded ? ["prompts"] : []}
            onChange={(keys) => setPromptsExpanded(keys.includes("prompts"))}
            items={[
              {
                key: "prompts",
                label: "提示词模板（高级，可选自定义）",
                children: (
                  <>
                    <Form.Item label="世界观提示词">
                      <Input.TextArea
                        rows={4}
                        value={prompts.world}
                        onChange={(e) => setPrompts({ ...prompts, world: e.target.value })}
                      />
                    </Form.Item>
                    <Form.Item label="角色提示词">
                      <Input.TextArea
                        rows={4}
                        value={prompts.character}
                        onChange={(e) => setPrompts({ ...prompts, character: e.target.value })}
                      />
                    </Form.Item>
                    <Form.Item label="大纲提示词">
                      <Input.TextArea
                        rows={4}
                        value={prompts.outline}
                        onChange={(e) => setPrompts({ ...prompts, outline: e.target.value })}
                      />
                    </Form.Item>
                    <Form.Item label="章节提示词">
                      <Input.TextArea
                        rows={4}
                        value={prompts.chapter}
                        onChange={(e) => setPrompts({ ...prompts, chapter: e.target.value })}
                      />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Card>
      )}

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
