import type { NovelItem } from '../types';

interface SidebarProps {
  novels: NovelItem[];
  selected: number;
  onSelect: (index: number) => void;
  onCreateNew: () => void;
}

function Sidebar({ novels, selected, onSelect, onCreateNew }: SidebarProps) {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <span>项目列表</span>
        <button className="btn-create" onClick={onCreateNew} title="创建新小说">
          +
        </button>
      </div>
      <ul className="sidebar-list">
        {novels.map((novel) => (
          <li
            key={novel.index}
            className={`sidebar-item ${novel.index === selected ? 'active' : ''}`}
            onClick={() => onSelect(novel.index)}
          >
            <div className="item-title">{novel.title}</div>
            <div className="item-progress">
              {novel.current_chapter} / {novel.target_chapters}
            </div>
          </li>
        ))}
        {novels.length === 0 && (
          <li className="sidebar-item">
            <div className="item-title" style={{ color: 'var(--text-dim)' }}>
              暂无项目
            </div>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default Sidebar;
