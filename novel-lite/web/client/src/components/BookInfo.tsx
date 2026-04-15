import type { NovelItem } from '../types';

interface BookInfoProps {
  novel: NovelItem;
}

function BookInfo({ novel }: BookInfoProps) {
  return (
    <div className="book-info">
      <h2>{novel.title}</h2>
      <div className="book-meta">
        <span>类型: {novel.genre || '-'}</span>
        <span>主题: {novel.theme || '-'}</span>
        <span>模型: {novel.model || '-'}</span>
        <span>创建: {novel.created || '-'}</span>
      </div>
    </div>
  );
}

export default BookInfo;
