interface ActionButtonsProps {
  writing: boolean;
  autoRunning: boolean;
  onWrite: () => void;
  onAutoStart: () => void;
  onAutoStop: () => void;
  onRefresh: () => void;
}

function ActionButtons({
  writing,
  autoRunning,
  onWrite,
  onAutoStart,
  onAutoStop,
  onRefresh,
}: ActionButtonsProps) {
  return (
    <div className="action-buttons">
      <button disabled={writing || autoRunning} onClick={onWrite}>
        创作下一章
      </button>
      <button
        className="btn-success"
        disabled={autoRunning}
        onClick={onAutoStart}
      >
        自动创作
      </button>
      <button
        className="btn-danger"
        disabled={!autoRunning}
        onClick={onAutoStop}
      >
        停止
      </button>
      <button onClick={onRefresh}>刷新</button>
    </div>
  );
}

export default ActionButtons;
