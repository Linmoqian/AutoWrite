'use client';

import { Search, X, Wand2 } from 'lucide-react';
import { GENRE_OPTIONS } from '@/types';
import { cn } from '@/lib/utils';

interface SearchFilterProps {
  searchQuery: string;
  selectedGenre: string | null;
  onSearchChange: (query: string) => void;
  onGenreChange: (genre: string | null) => void;
}

export function SearchFilter({
  searchQuery,
  selectedGenre,
  onSearchChange,
  onGenreChange,
}: SearchFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6 px-1">
      {/* 搜索框 */}
      <div className="relative flex-1 min-w-[240px] max-w-md">
        <div className={cn(
          'absolute left-4 top-1/2 -translate-y-1/2',
          'w-8 h-8 rounded-lg flex items-center justify-center',
          'bg-gradient-to-br from-purple-500/20 to-blue-500/20'
        )}>
          <Wand2 size={14} className="text-accent" aria-hidden="true" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索小说标题…"
          className={cn(
            'w-full pl-14 pr-12 py-3',
            'input-field rounded-xl',
            'text-text-primary placeholder-text-muted',
            'focus:outline-none'
          )}
          aria-label="搜索小说"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 p-1.5',
              'text-text-muted hover:text-text-primary',
              'hover:bg-white/5 rounded-lg transition-all duration-200'
            )}
            aria-label="清除搜索"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 类型筛选 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-muted font-medium">类型</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => onGenreChange(null)}
            className={cn(
              'px-4 py-2 text-sm rounded-xl font-medium',
              'transition-all duration-200 ease-out',
              selectedGenre === null
                ? 'btn-primary text-white'
                : 'bg-surface/50 text-text-secondary hover:bg-surface hover:text-text-primary border border-white/5'
            )}
            aria-pressed={selectedGenre === null}
          >
            全部
          </button>
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre.value}
              onClick={() => onGenreChange(genre.value)}
              className={cn(
                'px-4 py-2 text-sm rounded-xl font-medium',
                'transition-all duration-200 ease-out',
                selectedGenre === genre.value
                  ? 'btn-primary text-white'
                  : 'bg-surface/50 text-text-secondary hover:bg-surface hover:text-text-primary border border-white/5'
              )}
              aria-pressed={selectedGenre === genre.value}
            >
              {genre.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
