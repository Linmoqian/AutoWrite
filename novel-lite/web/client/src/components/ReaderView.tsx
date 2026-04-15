import { useState, useEffect, useRef } from 'react';
import type { ChapterContent, FontSize, ReaderTheme } from '../types';
import { fetchChapterContent } from '../api';
import MarkdownRenderer from './MarkdownRenderer';
import '../reader-themes.css';

interface ReaderViewProps {
  novelIdx: number;
  chapterNum: number;
  totalChapters: number;
  novelTitle: string;
  onBack: () => void;
  onNavigate: (num: number) => void;
}

const FONT_SIZE_MAP: Record<FontSize, number> = {
  small: 15,
  medium: 18,
  large: 22,
  xlarge: 26,
};

const FONT_SIZES: FontSize[] = ['small', 'medium', 'large', 'xlarge'];

const THEMES: { key: ReaderTheme; label: string; className: string }[] = [
  { key: 'dark', label: '暗色', className: 'theme-btn-dark' },
  { key: 'light', label: '浅色', className: 'theme-btn-light' },
  { key: 'sepia', label: '护眼', className: 'theme-btn-sepia' },
  { key: 'green', label: '墨绿', className: 'theme-btn-green' },
];

function ReaderView({
  novelIdx,
  chapterNum,
  totalChapters,
  novelTitle,
  onBack,
  onNavigate,
}: ReaderViewProps) {
  const [content, setContent] = useState<ChapterContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [theme, setTheme] = useState<ReaderTheme>('dark');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setLoading(true);
    bodyRef.current?.scrollTo(0, 0);
    fetchChapterContent(novelIdx, chapterNum)
      .then((data) => {
        if (!cancelled) {
          setContent(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [novelIdx, chapterNum]);

  const hasPrev = chapterNum > 1;
  const hasNext = chapterNum < totalChapters;

  return (
    <div className={`reader-view reader-theme-${theme}`}>
      <div className="reader-toolbar">
        <button className="reader-back-btn" onClick={onBack}>
          返回
        </button>
        <span className="reader-novel-title">{novelTitle}</span>
        <span className="reader-progress">
          第 {chapterNum} / {totalChapters} 章
        </span>
        <div className="reader-toolbar-right">
          <div className="font-size-controls">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                className={`font-btn ${fontSize === size ? 'active' : ''}`}
                onClick={() => setFontSize(size)}
                title={size}
                style={{ fontSize: FONT_SIZE_MAP[size] - 4 }}
              >
                A
              </button>
            ))}
          </div>
          <div className="theme-controls">
            {THEMES.map(({ key, label, className }) => (
              <button
                key={key}
                className={`theme-btn ${className} ${theme === key ? 'active' : ''}`}
                onClick={() => setTheme(key)}
                title={label}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="reader-body" ref={bodyRef}>
        {loading ? (
          <div className="reader-loading">加载中...</div>
        ) : content ? (
          <div className="reader-content">
            <h2 className="reader-chapter-title">
              第{content.num}章 {content.title}
            </h2>
            <div className="reader-chapter-ornament">
              <span>{content.words.toLocaleString()} 字</span>
            </div>
            <MarkdownRenderer
              content={content.body}
              fontSize={FONT_SIZE_MAP[fontSize]}
            />
          </div>
        ) : (
          <div className="reader-loading">章节内容加载失败</div>
        )}
      </div>

      <div className="reader-nav">
        <button
          className="nav-btn"
          disabled={!hasPrev}
          onClick={() => hasPrev && onNavigate(chapterNum - 1)}
        >
          上一章
        </button>
        <span className="nav-indicator">
          {chapterNum} / {totalChapters}
        </span>
        <button
          className="nav-btn"
          disabled={!hasNext}
          onClick={() => hasNext && onNavigate(chapterNum + 1)}
        >
          下一章
        </button>
      </div>
    </div>
  );
}

export default ReaderView;
