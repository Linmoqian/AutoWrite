export default function Home() {
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-white">小说创作看板</h1>
      <p className="text-slate-400 mt-1">管理你的 AI 小说创作进度</p>
      
      {/* 测试自定义颜色 */}
      <div className="mt-8 flex gap-4">
        <div className="w-12 h-12 rounded bg-kanban-todo" title="待写" />
        <div className="w-12 h-12 rounded bg-kanban-writing" title="撰写中" />
        <div className="w-12 h-12 rounded bg-kanban-reviewing" title="审核中" />
        <div className="w-12 h-12 rounded bg-kanban-published" title="已发布" />
      </div>
    </main>
  );
}
