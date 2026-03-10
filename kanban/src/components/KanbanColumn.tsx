'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Scroll } from 'lucide-react';
import type { Novel, NovelStatus } from '@/types';
import { COLUMN_CONFIG } from '@/types';
import { NovelCard } from './NovelCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  id: NovelStatus;
  novels: Novel[];
  onAddNovel?: (status: NovelStatus) => void;
  onEditNovel?: (novel: Novel) => void;
  onDeleteNovel?: (novelId: string) => void;
}

const columnStyles: Record<NovelStatus, { gradient: string; text: string; ring: string }> = {
  todo: {
    gradient: 'from-amber-500/20 to-orange-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/30',
  },
  writing: {
    gradient: 'from-sky-500/20 to-blue-500/10',
    text: 'text-sky-400',
    ring: 'ring-sky-500/30',
  },
  reviewing: {
    gradient: 'from-purple-500/20 to-violet-500/10',
    text: 'text-purple-400',
    ring: 'ring-purple-500/30',
  },
  published: {
    gradient: 'from-emerald-500/20 to-teal-500/10',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/30',
  },
};

export function KanbanColumn({ id, novels, onAddNovel, onEditNovel, onDeleteNovel }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const config = COLUMN_CONFIG[id];
  const novelIds = novels.map((n) => n.id);
  const style = columnStyles[id];

  return (
    <div className="flex flex-col min-w-[340px] max-w-[340px]">
      {/* 列头部 */}
      <header className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          {/* 状态图标 - 卷轴风格 */}
          <div className={cn(
            'relative w-9 h-9 rounded-lg flex items-center justify-center',
            'bg-gradient-to-br',
            style.gradient,
            'ring-1',
            style.ring
          )}>
            <Scroll size={18} className={cn(style.text)} aria-hidden="true" />
            {/* 脉冲效果 */}
            <div
              className={cn(
                'absolute inset-0 rounded-lg animate-ping opacity-20',
                style.gradient
              )}
              style={{ animationDuration: '3s' }}
            />
          </div>

          {/* 列标题 */}
          <h2 className="font-semibold text-text-primary tracking-wider font-display">
            {config.title}
          </h2>

          {/* 计数徽章 */}
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            'bg-surface/80 border border-border text-text-secondary',
            'shadow-sm'
          )}>
            {novels.length}
          </span>
        </div>

        {/* 添加按钮 */}
        <button
          onClick={() => onAddNovel?.(id)}
          className={cn(
            'p-2 rounded-lg transition-all duration-200',
            'text-text-muted hover:text-text-primary',
            'bg-surface/40 hover:bg-surface/80',
            'border border-transparent hover:border-border',
            'hover:shadow-sm'
          )}
          aria-label={`添加新小说到「${config.title}」`}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </header>

      {/* 卡片区域 */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-3 rounded-2xl min-h-[200px] kanban-column-bg',
          'transition-all duration-300 ease-out',
          isOver && 'border-accent/30 bg-accent/5 ring-1 ring-accent/20'
        )}
      >
        <SortableContext items={novelIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {novels.map((novel, index) => (
              <NovelCard
                key={novel.id}
                novel={novel}
                index={index}
                onEdit={onEditNovel}
                onDelete={onDeleteNovel}
              />
            ))}
          </div>
        </SortableContext>

        {/* 空状态 */}
        {novels.length === 0 && (
          <div className="flex flex-col items-center justify-center h-44 text-text-muted">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
              'bg-surface/60 border border-border'
            )}>
              <Scroll size={28} className="text-text-muted/40" aria-hidden="true" />
            </div>
            <p className="text-sm text-text-muted/70 tracking-wide">暂无作品</p>
            <button
              onClick={() => onAddNovel?.(id)}
              className={cn(
                'mt-4 px-4 py-2 rounded-lg text-sm',
                'bg-surface/60 hover:bg-surface text-text-secondary hover:text-text-primary',
                'border border-border hover:border-border-hover',
                'transition-all duration-200',
                'flex items-center gap-2'
              )}
            >
              <Plus size={14} aria-hidden="true" />
              开始创作
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
