import { useState, useEffect } from 'react';
import type { GenreOption, CreateNovelRequest } from '../types';
import { fetchGenres } from '../api';

interface CreateNovelModalProps {
  onClose: () => void;
  onSubmit: (data: CreateNovelRequest) => Promise<{ success: boolean; message: string }>;
}

function CreateNovelModal({ onClose, onSubmit }: CreateNovelModalProps) {
  const [genres, setGenres] = useState<GenreOption[]>([]);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('xuanhuan');
  const [theme, setTheme] = useState('修仙');
  const [targetChapters, setTargetChapters] = useState(100);
  const [wordsPerChapter, setWordsPerChapter] = useState(3000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGenres().then(setGenres).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('请输入小说标题');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await onSubmit({
      title: title.trim(),
      genre,
      theme: theme.trim(),
      target_chapters: targetChapters,
      words_per_chapter: wordsPerChapter,
    });
    if (!result.success) {
      setError(result.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>创建新小说</h3>
          <button className="modal-close" onClick={onClose}>
            x
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入小说标题"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>类型</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              {genres.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>主题</label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="如：修仙、复仇、探险"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>目标章数</label>
              <input
                type="number"
                value={targetChapters}
                onChange={(e) => setTargetChapters(Number(e.target.value))}
                min={1}
                max={10000}
              />
            </div>
            <div className="form-group">
              <label>每章字数</label>
              <input
                type="number"
                value={wordsPerChapter}
                onChange={(e) => setWordsPerChapter(Number(e.target.value))}
                min={500}
                max={10000}
                step={500}
              />
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateNovelModal;
