'use client';

import { X, Search } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-3 mb-5 px-1">
      {/* 搜索框 */}
      <div className="relative flex-1 min-w-[220px] max-w-xs">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索小说标题…"
          className={cn(
            'w-full pl-9 pr-10 py-2.5',
            'input-field rounded-lg',
            'text-sm text-text-primary placeholder-text-muted',
            'focus:outline-none'
          )}
          aria-label="搜索小说"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className={cn(
              'absolute right-2.5 top-1/2 -translate-y-1/2 p-1',
              'text-text-muted hover:text-text-primary',
              'hover:bg-white/5 rounded transition-all duration-200'
            )}
            aria-label="清除搜索"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 类型筛选 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted font-medium">类型</span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => onGenreChange(null)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-lg font-medium',
              'transition-all duration-200 ease-out',
              selectedGenre === null
                ? 'btn-primary text-white'
                : 'bg-surface/50 text-text-secondary hover:bg-surface hover:text-text-primary border border-border'
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
                'px-3 py-1.5 text-xs rounded-lg font-medium',
                'transition-all duration-200 ease-out',
                selectedGenre === genre.value
                  ? 'btn-primary text-white'
                  : 'bg-surface/50 text-text-secondary hover:bg-surface hover:text-text-primary border border-border'
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
