interface ChapterItem {
  num: number;
  title: string;
  words: number;
  created: string;
}

interface ChapterListProps {
  chapters: ChapterItem[];
  writtenCount: number;
  onSelect: (num: number) => void;
}

function ChapterList({ chapters, writtenCount, onSelect }: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="chapter-list-container">
        <h3 className="chapter-list-title">章节目录</h3>
        <div className="chapter-list-empty">暂无章节</div>
      </div>
    );
  }

  return (
    <div className="chapter-list-container">
      <h3 className="chapter-list-title">
        章节目录 ({chapters.length} 章)
      </h3>
      <div className="chapter-list-scroll">
        {chapters.map((ch) => {
          const isWritten = ch.num <= writtenCount;
          return (
            <div
              key={ch.num}
              className={`chapter-item ${isWritten ? 'written' : 'unwritten'}`}
              onClick={isWritten ? () => onSelect(ch.num) : undefined}
            >
              <span className="chapter-num">
                {isWritten ? ch.num : '—'}
              </span>
              <span className="chapter-title-text">
                {ch.title || `第 ${ch.num} 章`}
              </span>
              {isWritten && ch.words > 0 && (
                <span className="chapter-words">
                  {ch.words.toLocaleString()} 字
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChapterList;
