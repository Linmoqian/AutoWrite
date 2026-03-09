'use client';

import { FileText, Edit2, Trash2, Plus, Hash } from 'lucide-react';
import type { Chapter } from '@/types';
import { cn } from '@/lib/utils';
import { formatWordCount } from '@/lib/utils';

interface ChapterListProps {
  chapters: Chapter[];
  onAddChapter?: () => void;
  onEditChapter?: (chapter: Chapter) => void;
  onDeleteChapter?: (chapterId: string) => void;
}

const STATUS_CONFIG = {
  draft: {
    label: '草稿',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  reviewing: {
    label: '审核中',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  finalized: {
    label: '已定稿',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
};

export function ChapterList({
  chapters,
  onAddChapter,
  onEditChapter,
  onDeleteChapter,
}: ChapterListProps) {
  // 按章节号排序
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <header className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center',
            'bg-gradient-to-br from-violet-500/20 to-purple-500/20'
          )}>
            <FileText size={16} className="text-violet-400" aria-hidden="true" />
          </div>

          <h2 className="font-semibold text-text-primary tracking-wide">
            章节列表
          </h2>

          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            'bg-surface border border-white/5 text-text-secondary'
          )}>
            {chapters.length}
          </span>
        </div>

        {/* 添加章节按钮 */}
        <button
          onClick={() => onAddChapter?.()}
          className={cn(
            'p-2 rounded-xl transition-all duration-200',
            'text-text-muted hover:text-text-primary',
            'hover:bg-surface border border-transparent hover:border-white/5'
          )}
          aria-label="添加新章节"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </header>

      {/* 章节列表 */}
      <div className="flex-1 p-3 rounded-2xl bg-surface/50 border border-white/5">
        {sortedChapters.length > 0 ? (
          <div className="space-y-2">
            {sortedChapters.map((chapter) => {
              const statusConfig = STATUS_CONFIG[chapter.status];

              return (
                <div
                  key={chapter.id}
                  className={cn(
                    'group flex items-center gap-3 p-3 rounded-xl',
                    'bg-surface/50 border border-white/5',
                    'hover:bg-white/5 transition-all duration-200',
                    'cursor-pointer'
                  )}
                >
                  {/* 章节号 */}
                  <div className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                    'bg-gradient-to-br from-violet-500/10 to-purple-500/10',
                    'text-violet-400 font-medium text-sm'
                  )}>
                    <Hash size={14} className="mr-0.5" />
                    {chapter.number}
                  </div>

                  {/* 章节信息 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {chapter.title}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatWordCount(chapter.wordCount)}
                    </p>
                  </div>

                  {/* 状态徽章 */}
                  <span
                    className={cn(
                      'flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border',
                      statusConfig.className
                    )}
                  >
                    {statusConfig.label}
                  </span>

                  {/* 操作按钮 - hover 显示 */}
                  <div className={cn(
                    'flex-shrink-0 flex items-center gap-1',
                    'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                  )}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditChapter?.(chapter);
                      }}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors duration-200',
                        'text-text-muted hover:text-text-primary hover:bg-white/5'
                      )}
                      aria-label={`编辑第${chapter.number}章`}
                    >
                      <Edit2 size={14} aria-hidden="true" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChapter?.(chapter.id);
                      }}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors duration-200',
                        'text-text-muted hover:text-red-400 hover:bg-red-500/10'
                      )}
                      aria-label={`删除第${chapter.number}章`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // 空状态
          <div className="flex flex-col items-center justify-center h-40 text-text-muted">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center mb-3',
              'bg-surface border border-white/5'
            )}>
              <FileText size={24} className="text-text-muted/50" aria-hidden="true" />
            </div>
            <p className="text-sm text-text-muted/70">暂无章节</p>
            <button
              onClick={() => onAddChapter?.()}
              className={cn(
                'mt-3 text-sm text-accent hover:text-accent/80',
                'transition-colors duration-200',
                'flex items-center gap-1.5'
              )}
            >
              <Plus size={14} aria-hidden="true" />
              添加第一章
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
