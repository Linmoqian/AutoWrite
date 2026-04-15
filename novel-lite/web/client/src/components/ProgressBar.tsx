interface ProgressBarProps {
  current: number;
  total: number;
}

function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min((current / safeTotal) * 100, 100);

  return (
    <div className="progress-section">
      <div className="progress-header">
        <span>创作进度</span>
        <strong>
          {current} / {total}
        </strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default ProgressBar;
