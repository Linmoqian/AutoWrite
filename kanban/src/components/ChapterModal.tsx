'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save, FileText } from 'lucide-react';
import type { Chapter } from '@/types';
import { cn } from '@/lib/utils';

interface ChapterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (chapter: Chapter) => void;
  chapter?: Chapter | null;
  novelId: string;
  chapterNumber: number;
}

// 章节状态选项
const CHAPTER_STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'reviewing', label: '审核中' },
  { value: 'finalized', label: '已定稿' },
] as const;

// 生成章节 ID
function generateChapterId(): string {
  return `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 计算字数（中文字符 + 英文单词）
function countWords(text: string): number {
  if (!text) return 0;
  // 中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 英文单词
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
}

function ModalContent({
  onClose,
  onSave,
  chapter,
  novelId,
  chapterNumber,
}: Omit<ChapterModalProps, 'isOpen'>) {
  const [formData, setFormData] = useState<Partial<Chapter>>(() =>
    chapter || {
      novelId,
      number: chapterNumber,
      title: `第${chapterNumber}章`,
      content: '',
      wordCount: 0,
      status: 'draft',
    }
  );
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  // 实时计算字数
  const currentWordCount = countWords(formData.content || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;
    const now = new Date().toISOString();
    const newChapter: Chapter = {
      id: chapter?.id || generateChapterId(),
      novelId,
      number: formData.number!,
      title: formData.title!,
      content: formData.content || '',
      wordCount: currentWordCount,
      status: formData.status || 'draft',
      createdAt: chapter?.createdAt || now,
      updatedAt: now,
    };
    onSave(newChapter);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 bg-void/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content bg-surface/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-2xl border border-border shadow-2xl">
        {/* 头部 */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                'bg-indigo-500/10'
              )}
            >
              <FileText size={18} className="text-accent" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="modal-title"
                className="text-lg font-semibold text-text-primary"
              >
                {chapter ? '编辑章节' : '添加新章节'}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {chapter ? `第${chapter.number}章` : `第${chapterNumber}章`}
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
          {/* 章节标题 */}
          <div>
            <label
              htmlFor="chapter-title"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              章节标题 <span className="text-accent">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="chapter-title"
              name="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary placeholder-text-muted focus:outline-none text-sm"
              placeholder="输入章节标题…"
              required
              autoComplete="off"
            />
          </div>

          {/* 章节内容 */}
          <div className="relative">
            <label
              htmlFor="chapter-content"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              章节内容
            </label>
            <textarea
              ref={contentRef}
              id="chapter-content"
              name="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary placeholder-text-muted focus:outline-none resize-none min-h-[280px] text-sm"
              placeholder="开始撰写章节内容…"
              rows={14}
            />
            {/* 字数统计 */}
            <div className="absolute bottom-2.5 right-2.5 text-[11px] text-text-muted bg-elevated/80 px-2 py-1 rounded">
              {currentWordCount} 字
            </div>
          </div>

          {/* 章节状态 */}
          <div>
            <label
              htmlFor="chapter-status"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              章节状态
            </label>
            <select
              id="chapter-status"
              name="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as Chapter['status'],
                })
              }
              className="w-full px-3.5 py-2.5 input-field rounded-lg text-text-primary focus:outline-none appearance-none cursor-pointer text-sm"
            >
              {CHAPTER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
              <Save size={14} aria-hidden="true" />
              {chapter ? '保存更改' : '保存章节'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function ChapterModal({
  isOpen,
  onClose,
  onSave,
  chapter,
  novelId,
  chapterNumber,
}: ChapterModalProps) {
  if (!isOpen) return null;
  return (
    <ModalContent
      key={chapter?.id ?? 'new'}
      onClose={onClose}
      onSave={onSave}
      chapter={chapter}
      novelId={novelId}
      chapterNumber={chapterNumber}
    />
  );
}
