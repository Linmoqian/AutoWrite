'use client';

import { useEffect } from 'react';
import { KanbanBoard, ParticleBackground, GlowOrbs } from '@/components';
import { useKanbanStore } from '@/store';
import { sampleNovels } from '@/lib/sampleData';
import { BookOpen, Sparkles, PenTool } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const { novels, setNovels } = useKanbanStore();

  // 初始化示例数据（仅客户端，仅一次）
  useEffect(() => {
    if (novels.length === 0) {
      setNovels(sampleNovels);
    }
  }, [novels.length, setNovels]);

  const stats = {
    total: novels.length,
    published: novels.filter((n) => n.status === 'published').length,
    writing: novels.filter((n) => n.status === 'writing').length,
    totalWords: novels.reduce((acc, n) => acc + n.wordCount, 0),
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-void">
      {/* 背景效果 */}
      <ParticleBackground particleCount={40} />
      <GlowOrbs />

      {/* 页面头部 */}
      <header className="relative z-20 border-b border-white/5 bg-surface/30 backdrop-blur-xl">
        <div className="px-8 py-5 flex items-center justify-between">
          {/* Logo 和标题 */}
          <div className="flex items-center gap-5">
            <div className={cn(
              'relative w-12 h-12 rounded-2xl flex items-center justify-center',
              'bg-gradient-to-br from-purple-500 to-blue-600',
              'shadow-lg shadow-purple-500/30'
            )}>
              <BookOpen size={24} className="text-white" aria-hidden="true" />
              {/* 光晕效果 */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 blur-xl opacity-50" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight font-display">
                小说创作看板
              </h1>
              <p className="text-sm text-text-muted mt-0.5 flex items-center gap-2">
                <Sparkles size={12} className="text-amber-400" aria-hidden="true" />
                <span>AI 驱动的创作管理系统</span>
              </p>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="flex items-center gap-8">
            <StatCard
              icon={<PenTool size={16} />}
              label="创作中"
              value={stats.writing}
              color="blue"
            />
            <StatCard
              icon={<BookOpen size={16} />}
              label="已发布"
              value={stats.published}
              color="emerald"
            />
            <div className="h-10 w-px bg-white/10" />
            <div className="text-right">
              <div className="text-2xl font-bold text-text-primary">
                {formatNumber(stats.totalWords)}
              </div>
              <div className="text-xs text-text-muted">总字数</div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main id="main-content" className="flex-1 overflow-hidden relative z-10">
        <KanbanBoard />
      </main>
    </div>
  );
}

// 统计卡片组件
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'emerald';
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2 rounded-xl',
      'bg-surface/50 border border-white/5'
    )}>
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        color === 'blue' && 'bg-blue-500/20 text-blue-400',
        color === 'emerald' && 'bg-emerald-500/20 text-emerald-400',
      )}>
        {icon}
      </div>
      <div>
        <div className={cn(
          'text-xl font-bold',
          color === 'blue' && 'text-blue-400',
          color === 'emerald' && 'text-emerald-400',
        )}>
          {value}
        </div>
        <div className="text-xs text-text-muted">{label}</div>
      </div>
    </div>
  );
}

// 数字格式化
function formatNumber(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return num.toLocaleString();
}
