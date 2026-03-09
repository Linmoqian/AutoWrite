'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Edit2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Novel } from '@/types';
import { cn, formatDate, formatWordCount } from '@/lib/utils';
import { GENRE_OPTIONS, type NovelStatus } from '@/types';
import { useState } from 'react';

interface NovelCardProps {
  novel: Novel;
  index?: number;
  onEdit?: (novel: Novel) => void;
  onDelete?: (novelId: string) => void;
}

const statusGradients: Record<NovelStatus, string> = {
  todo: 'from-amber-500 to-orange-500',
  writing: 'from-blue-500 to-indigo-500',
  reviewing: 'from-purple-500 to-pink-500',
  published: 'from-emerald-500 to-teal-500',
};

export function NovelCard({ novel, index = 0, onEdit, onDelete }: NovelCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: novel.id });

  const [isHovered, setIsHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    animationDelay: `${index * 0.08}s`,
  };

  const genreLabel = GENRE_OPTIONS.find((g) => g.value === novel.genre)?.label || novel.genre;
  const progress = Math.min(100, Math.max(0, (novel.writtenChapters / novel.targetChapters) * 100));
  const gradient = statusGradients[novel.status];

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'card-enter card-glow-effect group relative rounded-2xl overflow-hidden',
        'cursor-grab active:cursor-grabbing',
        'transition-all duration-300 ease-out',
        isDragging && 'opacity-50 scale-105 rotate-2 z-50 shadow-2xl shadow-purple-500/20',
        !isDragging && 'hover:scale-[1.02] hover:-translate-y-1'
      )}
      style={style}
    >
      {/* 卡片背景 */}
      <div className="relative bg-surface/80 backdrop-blur-sm p-4 border border-white/5">
        {/* 顶部渐变边框 */}
        <div className={cn(
          'absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-60',
          gradient
        )} />

        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className={cn(
            'absolute -left-1 top-1/2 -translate-y-1/2 p-2',
            'text-text-muted hover:text-accent cursor-grab',
            'rounded-lg hover:bg-white/5 transition-all duration-200',
            isHovered && 'text-text-secondary'
          )}
          aria-label="拖拽排序"
        >
          <GripVertical size={14} aria-hidden="true" />
        </div>

        {/* 内容区 */}
        <div className="ml-6">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3
                onClick={() => router.push(`/novels/${novel.id}`)}
                className="font-semibold text-text-primary truncate text-base cursor-pointer hover:text-accent transition-colors"
              >
                {novel.title}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  'bg-gradient-to-r',
                  gradient,
                  'text-white/90'
                )}>
                  {genreLabel}
                </span>
                <span className="text-sm text-text-muted">{novel.theme}</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className={cn(
              'flex gap-0.5 transition-all duration-200',
              isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
            )}>
              <button
                onClick={() => onEdit?.(novel)}
                className="p-2 text-text-muted hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all duration-200"
                aria-label={`编辑《${novel.title}》`}
              >
                <Edit2 size={15} aria-hidden="true" />
              </button>
              <button
                onClick={() => onDelete?.(novel.id)}
                className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
                aria-label={`删除《${novel.title}》`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 进度信息 */}
          <div className="mt-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary font-medium">{novel.writtenChapters}</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">{novel.targetChapters}</span>
              <span className="text-text-muted ml-0.5">章</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-400" aria-hidden="true" />
              <span className="text-text-secondary font-medium">{formatWordCount(novel.wordCount)}</span>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mt-3 h-1.5 bg-ink/50 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full progress-bar transition-all duration-500 ease-out',
                'bg-gradient-to-r',
                gradient
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 更新时间 */}
          <p className="mt-3 text-xs text-text-muted flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-text-muted/50" />
            {formatDate(novel.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
