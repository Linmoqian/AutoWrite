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
      className="modal-backdrop fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content bg-surface/95 backdrop-blur-xl rounded-3xl p-8 w-full max-w-2xl border border-white/5 shadow-2xl shadow-black/50">
        {/* 头部 */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center',
                'bg-gradient-to-br from-purple-500/20 to-blue-500/20'
              )}
            >
              <FileText size={22} className="text-accent" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="modal-title"
                className="text-xl font-semibold text-text-primary font-display"
              >
                {chapter ? '编辑章节' : '添加新章节'}
              </h2>
              <p className="text-sm text-text-muted mt-0.5">
                {chapter ? `第${chapter.number}章` : `第${chapterNumber}章`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2.5 rounded-xl transition-all duration-200',
              'text-text-muted hover:text-text-primary',
              'hover:bg-white/5'
            )}
            aria-label="关闭"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 章节标题 */}
          <div>
            <label
              htmlFor="chapter-title"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              章节标题 <span className="text-purple-400">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="chapter-title"
              name="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 input-field rounded-xl text-text-primary placeholder-text-muted focus:outline-none"
              placeholder="输入章节标题…"
              required
              autoComplete="off"
            />
          </div>

          {/* 章节内容 */}
          <div className="relative">
            <label
              htmlFor="chapter-content"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              章节内容
            </label>
            <textarea
              ref={contentRef}
              id="chapter-content"
              name="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-3 input-field rounded-xl text-text-primary placeholder-text-muted focus:outline-none resize-none min-h-[300px]"
              placeholder="开始撰写章节内容…"
              rows={15}
            />
            {/* 字数统计 */}
            <div className="absolute bottom-3 right-3 text-xs text-text-muted bg-surface/80 px-2 py-1 rounded-md">
              {currentWordCount} 字
            </div>
          </div>

          {/* 章节状态 */}
          <div>
            <label
              htmlFor="chapter-status"
              className="block text-sm font-medium text-text-secondary mb-2"
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
              className="w-full px-4 py-3 input-field rounded-xl text-text-primary focus:outline-none appearance-none cursor-pointer"
            >
              {CHAPTER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 按钮 */}
          <footer className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'px-6 py-3 rounded-xl font-medium',
                'text-text-secondary hover:text-text-primary',
                'hover:bg-white/5 transition-all duration-200'
              )}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary px-6 py-3 rounded-xl font-medium text-white flex items-center gap-2"
            >
              <Save size={16} aria-hidden="true" />
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
