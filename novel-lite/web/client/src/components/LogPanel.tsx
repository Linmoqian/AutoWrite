import { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
}

function LogPanel({ logs }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="log-panel">
      {logs.length === 0 && (
        <div style={{ color: 'var(--text-dim)' }}>等待日志...</div>
      )}
      {logs.map((entry, i) => (
        <div key={i} className={`log-entry level-${entry.level}`}>
          <span className="log-time">{entry.timestamp}</span>
          <span className="log-msg">{entry.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export default LogPanel;
