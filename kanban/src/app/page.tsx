import { KanbanBoard } from '@/components';
import { useKanbanStore } from '@/store';
import { sampleNovels } from '@/lib/sampleData';

// 初始化示例数据
if (typeof window !== 'undefined' && useKanbanStore.getState().novels.length === 0) {
  useKanbanStore.getState().setNovels(sampleNovels);
}

export default function Home() {
  return (
    <main className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">小说创作看板</h1>
        <p className="text-slate-400 mt-1">管理你的 AI 小说创作进度</p>
      </header>
      <KanbanBoard />
    </main>
  );
}
