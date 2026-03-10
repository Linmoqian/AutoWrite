'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, BookOpen } from 'lucide-react';
import type { Novel } from '@/types';
import { NovelStatus, WorkflowStatus, GENRE_OPTIONS } from '@/types';
import { generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface NovelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (novel: Novel) => void;
  novel?: Novel | null;
  defaultStatus?: NovelStatus;
}

function ModalContent({ onClose, onSave, novel, defaultStatus = NovelStatus.TODO }: Omit<NovelModalProps, 'isOpen'>) {
  // 根据状态映射默认的工作流状态
  const getDefaultWorkflowStatus = (status: NovelStatus): WorkflowStatus => {
    const mapping: Record<NovelStatus, WorkflowStatus> = {
      [NovelStatus.TODO]: WorkflowStatus.OUTLINE,
      [NovelStatus.WRITING]: WorkflowStatus.WRITING,
      [NovelStatus.REVIEWING]: WorkflowStatus.AI_REVIEW,
      [NovelStatus.PUBLISHED]: WorkflowStatus.PUBLISHED,
    };
    return mapping[status];
  };

  const [formData, setFormData] = useState<Partial<Novel>>(() =>
    novel || {
      title: '',
      genre: 'xuanhuan',
      theme: '',
      targetChapters: 100,
      writtenChapters: 0,
      wordCount: 0,
      description: '',
      status: defaultStatus,
      workflowStatus: getDefaultWorkflowStatus(defaultStatus),
    }
  );
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;
    const now = new Date();
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
      workflowStatus: formData.workflowStatus || getDefaultWorkflowStatus(formData.status || defaultStatus),
      createdAt: novel?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
    };
    onSave(newNovel);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 bg-void/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content bg-surface/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-lg border border-border shadow-2xl">
        {/* 头部 */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              'bg-indigo-500/10'
            )}>
              <BookOpen size={18} className="text-accent" aria-hidden="true" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-semibold text-text-primary">
                {novel ? '编辑小说' : '创建新小说'}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {novel ? '修改小说信息' : '开始你的创作之旅'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg transition-all duration-200',
              'text-text-muted hover:text-text-primary',
              'hover:bg-white/5'
            )}
            aria-label="关闭"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 标题 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-text-secondary mb-1.5">
              小说标题 <span className="text-accent">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary placeholder-text-muted focus:outline-none text-sm"
              placeholder="输入一个吸引人的标题…"
              required
              autoComplete="off"
            />
          </div>

          {/* 类型和主题 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="genre" className="block text-sm font-medium text-text-secondary mb-1.5">
                小说类型
              </label>
              <select
                id="genre"
                name="genre"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary focus:outline-none appearance-none cursor-pointer text-sm"
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-text-secondary mb-1.5">
                主题标签
              </label>
              <input
                id="theme"
                name="theme"
                type="text"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary placeholder-text-muted focus:outline-none text-sm"
                placeholder="如：修仙、都市"
                autoComplete="off"
              />
            </div>
          </div>

          {/* 章节和字数 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="targetChapters" className="block text-sm font-medium text-text-secondary mb-1.5">
                目标章节
              </label>
              <input
                id="targetChapters"
                name="targetChapters"
                type="number"
                value={formData.targetChapters}
                onChange={(e) => setFormData({ ...formData, targetChapters: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary focus:outline-none text-sm"
                min="1"
              />
            </div>
            <div>
              <label htmlFor="writtenChapters" className="block text-sm font-medium text-text-secondary mb-1.5">
                已写章节
              </label>
              <input
                id="writtenChapters"
                name="writtenChapters"
                type="number"
                value={formData.writtenChapters}
                onChange={(e) => setFormData({ ...formData, writtenChapters: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary focus:outline-none text-sm"
                min="0"
              />
            </div>
            <div>
              <label htmlFor="wordCount" className="block text-sm font-medium text-text-secondary mb-1.5">
                总字数
              </label>
              <input
                id="wordCount"
                name="wordCount"
                type="number"
                value={formData.wordCount}
                onChange={(e) => setFormData({ ...formData, wordCount: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary focus:outline-none text-sm"
                min="0"
              />
            </div>
          </div>

          {/* 简介 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1.5">
              内容简介
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary placeholder-text-muted focus:outline-none resize-none text-sm"
              rows={3}
              placeholder="简述你的故事…"
            />
          </div>

          {/* 按钮 */}
          <footer className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'px-4 py-2.5 rounded-lg font-medium text-sm',
                'text-text-secondary hover:text-text-primary',
                'hover:bg-white/5 transition-all duration-200'
              )}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2.5 rounded-lg font-medium text-sm text-white flex items-center gap-2"
            >
              <Sparkles size={14} aria-hidden="true" />
              {novel ? '保存更改' : '开始创作'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function NovelModal({ isOpen, onClose, onSave, novel, defaultStatus }: NovelModalProps) {
  if (!isOpen) return null;
  return (
    <ModalContent
      key={novel?.id ?? 'new'}
      onClose={onClose}
      onSave={onSave}
      novel={novel}
      defaultStatus={defaultStatus}
    />
  );
}
