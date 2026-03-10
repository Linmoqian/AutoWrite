'use client';

import { useEffect } from 'react';
import { KanbanBoard, ParticleBackground, GlowOrbs } from '@/components';
import { useKanbanStore } from '@/store';
import { BookOpen, Sparkles, PenTool, Feather } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const { novels, loadNovels } = useKanbanStore();

  // 从 API 加载数据
  useEffect(() => {
    loadNovels();
  }, [loadNovels]);

  const stats = {
    total: novels.length,
    published: novels.filter((n) => n.status === 'published').length,
    writing: novels.filter((n) => n.status === 'writing').length,
    totalWords: novels.reduce((acc, n) => acc + n.wordCount, 0),
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-void">
      {/* 墨迹粒子背景 */}
      <ParticleBackground particleCount={35} />
      <GlowOrbs />

      {/* 页面头部 - 书斋风格 */}
      <header className="relative z-20 border-b border-border bg-abyss/40 backdrop-blur-xl">
        <div className="px-8 py-6 flex items-center justify-between">
          {/* Logo 和标题 */}
          <div className="flex items-center gap-6">
            {/* 印章式 Logo */}
            <div className="relative group">
              <div className={cn(
                'relative w-14 h-14 rounded-lg flex items-center justify-center',
                'bg-gradient-to-br from-red-700 to-red-900',
                'border-2 border-amber-200/20',
                'shadow-lg shadow-red-900/30'
              )}>
                <Feather size={28} className="text-amber-100" aria-hidden="true" />
                {/* 印章纹理效果 */}
                <div className="absolute inset-0 rounded-lg opacity-20"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                  }}
                />
              </div>
              {/* 光晕 */}
              <div className="absolute inset-0 rounded-lg bg-red-600/30 blur-xl group-hover:bg-red-500/40 transition-colors duration-300" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-text-primary tracking-wider font-display">
                墨韵书斋
              </h1>
              <p className="text-sm text-text-muted mt-1 flex items-center gap-2">
                <span className="inline-block w-8 h-px bg-gradient-to-r from-gold to-transparent" />
                <span>AI 驱动的小说创作系统</span>
                <Sparkles size={12} className="text-gold" aria-hidden="true" />
              </p>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="flex items-center gap-6">
            <StatCard
              icon={<PenTool size={18} />}
              label="创作中"
              value={stats.writing}
              color="blue"
            />
            <StatCard
              icon={<BookOpen size={18} />}
              label="已发布"
              value={stats.published}
              color="emerald"
            />
            <div className="h-12 w-px bg-border" />
            <div className="text-right">
              <div className="text-2xl font-bold text-text-primary font-display">
                {formatNumber(stats.totalWords)}
              </div>
              <div className="text-xs text-text-muted tracking-wider">总字数</div>
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

// 统计卡片组件 - 印章风格
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
      'relative flex items-center gap-3 px-5 py-3 rounded-xl',
      'bg-surface/60 border border-border',
      'backdrop-blur-sm',
      'group hover:border-border-hover transition-all duration-300'
    )}>
      {/* 装饰角 */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-gold/30" />

      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center',
        'transition-transform duration-300 group-hover:scale-110',
        color === 'blue' && 'bg-blue-500/15 text-blue-400',
        color === 'emerald' && 'bg-emerald-500/15 text-emerald-400',
      )}>
        {icon}
      </div>
      <div>
        <div className={cn(
          'text-2xl font-bold font-display tracking-wide',
          color === 'blue' && 'text-blue-400',
          color === 'emerald' && 'text-emerald-400',
        )}>
          {value}
        </div>
        <div className="text-xs text-text-muted tracking-wider">{label}</div>
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
