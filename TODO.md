[x] 技术选型
[x] 排查Claude插件加载失败
[x] 模型选择
[x] 大纲设计功能（极简版 novel-lite/write.py）
[x] 章节内容生成（极简版 novel-lite/write.py）
[x] 本地记忆功能（context.md 单文件摘要）
[x] TUI 终端仪表盘（novel-lite/tui.py）
[x] Web Dashboard（novel-lite/web/）
[x] 模型选择器（Ollama 模型列表 + 动态切换）
[x] 章节阅读器（Markdown 渲染 + 多主题 + 字号调节）
[x] 章节润色功能（novel-lite/polish.py）
[x] 流式创作输出（Ollama stream + SSE 实时推送）
[ ] 检查生成功能
[ ] 自动发布功能
[ ] 自动更新功能

[x] 接入工程规范（docs/development/ + skills/，源：lin-workflow）
[x] 回切 Rust 后端，移除 Node.js server 层

[x] 阶段 1：根目录 novel-app/ 重命名为 app/，Rust lib 改名 autowrite_lib
[x] 阶段 2：Rust 后端结构化拆分
[ ] 阶段 3：前端工程化基础设施
[ ] 阶段 4：前端架构迁移
[ ] 阶段 5：CI workflow + 文档更新 + 收尾
