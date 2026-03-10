'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Edit2, Sparkles, Scroll } from 'lucide-react';
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

const statusStyles: Record<NovelStatus, { gradient: string; bg: string; text: string }> = {
  todo: {
    gradient: 'from-amber-600 to-orange-700',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
  },
  writing: {
    gradient: 'from-sky-600 to-blue-700',
    bg: 'bg-sky-500/10',
    text: 'text-sky-300',
  },
  reviewing: {
    gradient: 'from-purple-600 to-violet-700',
    bg: 'bg-purple-500/10',
    text: 'text-purple-300',
  },
  published: {
    gradient: 'from-emerald-600 to-teal-700',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
  },
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

  const handleCardClick = (e: React.MouseEvent) => {
    // 如果点击的是按钮或拖拽手柄，不跳转
    if ((e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest('[aria-label="拖拽排序"]')) {
      return;
    }
    router.push(`/novels/${novel.id}`);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    animationDelay: `${index * 0.05}s`,
  };

  const genreLabel = GENRE_OPTIONS.find((g) => g.value === novel.genre)?.label || novel.genre;
  const progress = Math.min(100, Math.max(0, (novel.writtenChapters / novel.targetChapters) * 100));
  const statusStyle = statusStyles[novel.status];

  return (
    <div
      ref={setNodeRef}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'card-enter group relative rounded-xl overflow-hidden',
        'cursor-pointer select-none',
        'transition-all duration-300 ease-out',
        isDragging && 'opacity-60 scale-[1.03] rotate-1 z-50 shadow-2xl shadow-black/50',
        !isDragging && 'hover:scale-[1.01] hover:-translate-y-0.5'
      )}
      style={style}
    >
      {/* 卡片主体 */}
      <div className={cn(
        'relative bg-surface/90 backdrop-blur-sm p-4',
        'border border-border group-hover:border-border-hover',
        'transition-all duration-300'
      )}>
        {/* 顶部状态色条 - 墨迹渐变 */}
        <div className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
          statusStyle.gradient
        )} />

        {/* 左侧装饰边 */}
        <div className="absolute left-0 top-6 bottom-4 w-0.5 bg-gradient-to-b from-transparent via-gold/20 to-transparent" />

        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className={cn(
            'absolute -left-1 top-1/2 -translate-y-1/2 p-2',
            'text-text-muted hover:text-accent cursor-grab active:cursor-grabbing',
            'rounded-lg hover:bg-white/5 transition-all duration-200',
            isHovered && 'text-text-secondary'
          )}
          aria-label="拖拽排序"
        >
          <GripVertical size={14} aria-hidden="true" />
        </div>

        {/* 内容区 */}
        <div className="ml-5">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-text-primary truncate text-base tracking-wide">
                {novel.title}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                {/* 类型标签 - 印章风格 */}
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  statusStyle.bg,
                  statusStyle.text
                )}>
                  {genreLabel}
                </span>
                <span className="text-xs text-text-muted">{novel.theme}</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className={cn(
              'flex gap-0.5 transition-all duration-200',
              isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
            )}>
              <button
                onClick={() => onEdit?.(novel)}
                className={cn(
                  'p-1.5 rounded-lg transition-all duration-200',
                  'text-text-muted hover:text-sky-400 hover:bg-sky-400/10'
                )}
                aria-label={`编辑《${novel.title}》`}
              >
                <Edit2 size={14} aria-hidden="true" />
              </button>
              <button
                onClick={() => onDelete?.(novel.id)}
                className={cn(
                  'p-1.5 rounded-lg transition-all duration-200',
                  'text-text-muted hover:text-red-400 hover:bg-red-400/10'
                )}
                aria-label={`删除《${novel.title}》`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 进度信息 */}
          <div className="mt-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Scroll size={14} className="text-text-muted" aria-hidden="true" />
              <span className="text-text-secondary font-medium">{novel.writtenChapters}</span>
              <span className="text-text-muted">/</span>
              <span className="text-text-muted">{novel.targetChapters}</span>
              <span className="text-text-muted ml-0.5">章</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-gold" aria-hidden="true" />
              <span className="text-text-secondary font-medium">{formatWordCount(novel.wordCount)}</span>
            </div>
          </div>

          {/* 进度条 - 墨迹风格 */}
          <div className="mt-3 h-1.5 bg-ink/60 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full progress-bar transition-all duration-500 ease-out',
                'bg-gradient-to-r',
                statusStyle.gradient
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 更新时间 */}
          <p className="mt-3 text-xs text-text-muted flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-gold/50" />
            {formatDate(novel.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
