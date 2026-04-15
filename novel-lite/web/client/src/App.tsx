import { useState, useEffect, useRef, useCallback } from 'react';
import type { NovelItem, LogEntry, StatusInfo } from './types';
import { fetchNovels, writeNext, autoStart, autoStop, fetchStatus } from './api';
import Sidebar from './components/Sidebar';
import BookInfo from './components/BookInfo';
import ProgressBar from './components/ProgressBar';
import ActionButtons from './components/ActionButtons';
import LogPanel from './components/LogPanel';
import './App.css';

function App() {
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<StatusInfo>({
    model: '',
    elapsed: '00:00:00',
    session_chapters: 0,
    auto_running: false,
  });
  const [writing, setWriting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadNovels = useCallback(async () => {
    const data = await fetchNovels();
    setNovels(data);
    if (data.length > 0 && selected === -1) {
      setSelected(0);
    }
  }, [selected]);

  useEffect(() => {
    loadNovels();
    const timer = setInterval(loadNovels, 15000);
    return () => clearInterval(timer);
  }, [loadNovels]);

  useEffect(() => {
    const timer = setInterval(async () => {
      const s = await fetchStatus();
      setStatus(s);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // SSE 日志连接
  useEffect(() => {
    if (selected < 0) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/novels/${selected}/logs`);
    es.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data);
        setLogs((prev) => [...prev.slice(-200), entry]);
      } catch {
        // ignore parse errors
      }
    };

    eventSourceRef.current = es;
    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [selected]);

  const handleWrite = async () => {
    if (selected < 0) return;
    setWriting(true);
    await writeNext(selected);
    await loadNovels();
    setWriting(false);
  };

  const handleAutoStart = async () => {
    if (selected < 0) return;
    await autoStart(selected);
    setStatus((s) => ({ ...s, auto_running: true }));
  };

  const handleAutoStop = async () => {
    if (selected < 0) return;
    await autoStop(selected);
    setStatus((s) => ({ ...s, auto_running: false }));
    await loadNovels();
  };

  const novel = selected >= 0 ? novels[selected] : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Novel-Lite Dashboard</h1>
        <span className="app-model">模型: {status.model || '-'}</span>
      </header>

      <div className="app-body">
        <Sidebar
          novels={novels}
          selected={selected}
          onSelect={setSelected}
        />

        <main className="main-area">
          {novel ? (
            <>
              <BookInfo novel={novel} />
              <ProgressBar
                current={novel.current_chapter}
                total={novel.target_chapters}
              />
              <div className="stats-row">
                <span className="stat-item">
                  总字数: {novel.total_words.toLocaleString()}
                </span>
                <span className="stat-item">
                  状态:{' '}
                  {novel.current_chapter >= novel.target_chapters
                    ? '已完成'
                    : '创作中'}
                </span>
              </div>
              <ActionButtons
                writing={writing}
                autoRunning={status.auto_running}
                onWrite={handleWrite}
                onAutoStart={handleAutoStart}
                onAutoStop={handleAutoStop}
                onRefresh={loadNovels}
              />
              <LogPanel logs={logs} />
            </>
          ) : (
            <div className="empty-state">
              <p>未发现小说项目</p>
              <p className="hint">请先使用 python write.py new 创建</p>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <span>运行: {status.elapsed}</span>
        <span>|</span>
        <span>本会话: {status.session_chapters}章</span>
      </footer>
    </div>
  );
}

export default App;
