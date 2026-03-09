'use client';

import { Search, X } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-4 mb-6">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索小说标题..."
          className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">类型:</span>
        <div className="flex gap-1">
          <button onClick={() => onGenreChange(null)}
            className={cn('px-3 py-1.5 text-sm rounded-lg', selectedGenre === null ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
            全部
          </button>
          {GENRE_OPTIONS.map((genre) => (
            <button key={genre.value} onClick={() => onGenreChange(genre.value)}
              className={cn('px-3 py-1.5 text-sm rounded-lg', selectedGenre === genre.value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
              {genre.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
