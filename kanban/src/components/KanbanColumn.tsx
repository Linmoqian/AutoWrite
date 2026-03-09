'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, BookOpen } from 'lucide-react';
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

export function KanbanColumn({ id, novels, onAddNovel, onEditNovel, onDeleteNovel }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const config = COLUMN_CONFIG[id];
  const novelIds = novels.map((n) => n.id);

  return (
    <div className="flex flex-col min-w-[340px] max-w-[340px]">
      {/* 列头部 */}
      <header className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          {/* 状态图标 */}
          <div className={cn(
            'relative w-8 h-8 rounded-xl flex items-center justify-center',
            'bg-gradient-to-br',
            id === 'todo' && 'from-amber-500/20 to-orange-500/20',
            id === 'writing' && 'from-blue-500/20 to-indigo-500/20',
            id === 'reviewing' && 'from-purple-500/20 to-pink-500/20',
            id === 'published' && 'from-emerald-500/20 to-teal-500/20',
          )}>
            <BookOpen size={16} className={cn(
              id === 'todo' && 'text-amber-400',
              id === 'writing' && 'text-blue-400',
              id === 'reviewing' && 'text-purple-400',
              id === 'published' && 'text-emerald-400',
            )} aria-hidden="true" />
            {/* 脉冲效果 */}
            <div className={cn(
              'absolute inset-0 rounded-xl animate-ping',
              id === 'todo' && 'bg-amber-500/20',
              id === 'writing' && 'bg-blue-500/20',
              id === 'reviewing' && 'bg-purple-500/20',
              id === 'published' && 'bg-emerald-500/20',
            )} style={{ animationDuration: '3s' }} />
          </div>

          <h2 className="font-semibold text-text-primary tracking-wide">
            {config.title}
          </h2>

          {/* 计数徽章 */}
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            'bg-surface border border-white/5 text-text-secondary'
          )}>
            {novels.length}
          </span>
        </div>

        {/* 添加按钮 */}
        <button
          onClick={() => onAddNovel?.(id)}
          className={cn(
            'p-2 rounded-xl transition-all duration-200',
            'text-text-muted hover:text-text-primary',
            'hover:bg-surface border border-transparent hover:border-white/5'
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
          isOver && 'border-accent/30 bg-accent/5'
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
          <div className="flex flex-col items-center justify-center h-40 text-text-muted">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center mb-3',
              'bg-surface border border-white/5'
            )}>
              <BookOpen size={24} className="text-text-muted/50" aria-hidden="true" />
            </div>
            <p className="text-sm text-text-muted/70">暂无小说</p>
            <button
              onClick={() => onAddNovel?.(id)}
              className={cn(
                'mt-3 text-sm text-accent hover:text-accent/80',
                'transition-colors duration-200',
                'flex items-center gap-1.5'
              )}
            >
              <Plus size={14} aria-hidden="true" />
              添加第一本
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
