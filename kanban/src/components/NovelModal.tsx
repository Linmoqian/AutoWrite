'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Novel, NovelStatus } from '@/types';
import { GENRE_OPTIONS } from '@/types';
import { generateId } from '@/lib/utils';

interface NovelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (novel: Novel) => void;
  novel?: Novel | null;
  defaultStatus?: NovelStatus;
}

export function NovelModal({ isOpen, onClose, onSave, novel, defaultStatus = 'todo' }: NovelModalProps) {
  const [formData, setFormData] = useState<Partial<Novel>>({
    title: '', genre: 'xuanhuan', theme: '', targetChapters: 100, writtenChapters: 0, wordCount: 0, description: '', status: defaultStatus,
  });

  useEffect(() => {
    if (novel) setFormData(novel);
    else setFormData({ title: '', genre: 'xuanhuan', theme: '', targetChapters: 100, writtenChapters: 0, wordCount: 0, description: '', status: defaultStatus });
  }, [novel, defaultStatus, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;
    const now = new Date().toISOString();
    const newNovel: Novel = {
      id: novel?.id || generateId(),
      title: formData.title!,
      genre: formData.genre!,
      theme: formData.theme || '',
      targetChapters: formData.targetChapters || 100,
      writtenChapters: formData.writtenChapters || 0,
      wordCount: formData.wordCount || 0,
      description: formData.description,
      status: formData.status || defaultStatus,
      createdAt: novel?.createdAt || now,
      updatedAt: now,
    };
    onSave(newNovel);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">{novel ? '编辑小说' : '新建小说'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">标题 *</label>
            <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">类型</label>
              <select value={formData.genre} onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
                {GENRE_OPTIONS.map((g) => (<option key={g.value} value={g.value}>{g.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">主题</label>
              <input type="text" value={formData.theme} onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="如：修仙" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">目标章节</label>
              <input type="number" value={formData.targetChapters} onChange={(e) => setFormData({ ...formData, targetChapters: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" min="1" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">已写章节</label>
              <input type="number" value={formData.writtenChapters} onChange={(e) => setFormData({ ...formData, writtenChapters: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" min="0" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">字数</label>
              <input type="number" value={formData.wordCount} onChange={(e) => setFormData({ ...formData, wordCount: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" min="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">简介</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none" rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
