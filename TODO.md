[x] 技术选型
[x] 排查Claude插件加载失败
[x] 模型选择
[x] 大纲设计功能（极简版 novel-lite/write.py）
[x] 章节内容生成（极简版 novel-lite/write.py）
[x] 本地记忆功能（context.md 单文件摘要）
[ ] 检查生成功能
[ ] 自动发布功能
[ ] 自动更新功能

---

## 极简本地小说创作系统（2026-03-12）

### 2026-03-12 模块化重构完成

重构为 5 个模块 + 16 个测试全部通过：
- `config.yaml` - 配置文件
- `config.py` - 配置读取
- `files.py` - 文件操作
- `ai.py` - AI 调用
- `core.py` - 核心逻辑
- `cli.py` - 命令行入口
- `write.py` - 简化入口点

```bash
# 使用方式
cd novel-lite
python write.py new "修仙传奇" --genre xuanhuan --theme 修仙 --chapters 100
python write.py outline   # 生成大纲（含世界观、角色）
python write.py write     # 撰写下一章
```

**设计文档：** `docs/superpowers/specs/2026-03-12-novel-lite-refactor-design.md`
**实现计划：** `docs/superpowers/plans/2026-03-12-novel-lite-refactor.md`
