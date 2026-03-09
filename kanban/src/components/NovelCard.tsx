'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Edit2 } from 'lucide-react';
import type { Novel } from '@/types';
import { cn, formatDate, formatWordCount } from '@/lib/utils';
import { GENRE_OPTIONS } from '@/types';

interface NovelCardProps {
  novel: Novel;
  onEdit?: (novel: Novel) => void;
  onDelete?: (novelId: string) => void;
}

export function NovelCard({ novel, onEdit, onDelete }: NovelCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: novel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const genreLabel = GENRE_OPTIONS.find((g) => g.value === novel.genre)?.label || novel.genre;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-slate-800 rounded-lg p-4 cursor-grab active:cursor-grabbing',
        'border border-slate-700 hover:border-slate-600',
        'transition-all duration-200',
        isDragging && 'opacity-50 shadow-lg shadow-black/50 scale-105'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 text-slate-500 hover:text-slate-400 cursor-grab"
        >
          <GripVertical size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate">{novel.title}</h3>
          <p className="text-sm text-slate-400 mt-1">{genreLabel} · {novel.theme}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit?.(novel)} className="p-1 text-slate-400 hover:text-blue-400">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete?.(novel.id)} className="p-1 text-slate-400 hover:text-red-400">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{novel.writtenChapters}/{novel.targetChapters} 章</span>
        <span>{formatWordCount(novel.wordCount)}</span>
      </div>
      <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" 
          style={{ width: `${(novel.writtenChapters / novel.targetChapters) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-600">更新于 {formatDate(novel.updatedAt)}</p>
    </div>
  );
}
