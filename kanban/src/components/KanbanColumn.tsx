'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
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
    <div className="flex flex-col min-w-[300px] max-w-[300px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn('w-3 h-3 rounded-full', config.color)} />
          <h2 className="font-semibold text-white">{config.title}</h2>
          <span className="text-sm text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{novels.length}</span>
        </div>
        <button onClick={() => onAddNovel?.(id)} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
          <Plus size={18} />
        </button>
      </div>
      <div ref={setNodeRef} className={cn('flex-1 p-2 rounded-lg transition-colors min-h-[200px]', isOver ? 'bg-slate-700/50' : 'bg-slate-800/30')}>
        <SortableContext items={novelIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {novels.map((novel) => (
              <NovelCard key={novel.id} novel={novel} onEdit={onEditNovel} onDelete={onDeleteNovel} />
            ))}
          </div>
        </SortableContext>
        {novels.length === 0 && (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">暂无小说</div>
        )}
      </div>
    </div>
  );
}
