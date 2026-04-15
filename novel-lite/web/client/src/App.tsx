import { useState, useEffect, useRef, useCallback } from 'react';
import type { NovelItem, LogEntry, StatusInfo, OllamaStatus, ViewMode, CreateNovelRequest } from './types';
import {
  fetchNovels,
  fetchChapters,
  writeNext,
  autoStart,
  autoStop,
  fetchStatus,
  fetchOllamaStatus,
  createNovel,
} from './api';
import Sidebar from './components/Sidebar';
import BookInfo from './components/BookInfo';
import ProgressBar from './components/ProgressBar';
import ActionButtons from './components/ActionButtons';
import LogPanel from './components/LogPanel';
import CreateNovelModal from './components/CreateNovelModal';
import ChapterList from './components/ChapterList';
import ReaderView from './components/ReaderView';
import ModelSelector from './components/ModelSelector';
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
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    connected: false,
    models: [],
    default: '',
  });
  const [selectedModel, setSelectedModel] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [readingChapter, setReadingChapter] = useState(0);
  const [chapters, setChapters] = useState<
    { num: number; title: string; words: number; created: string }[]
  >([]);

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

  useEffect(() => {
    const loadOllama = async () => {
      const s = await fetchOllamaStatus();
      setOllamaStatus(s);
      if (s.connected && !selectedModel) {
        setSelectedModel(s.default || s.models[0] || '');
      }
    };
    loadOllama();
    const timer = setInterval(loadOllama, 60000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (selected < 0) {
      setChapters([]);
      return;
    }
    fetchChapters(selected).then(setChapters).catch(() => setChapters([]));
  }, [selected, novels]);

  const handleWrite = async () => {
    if (selected < 0) return;
    setWriting(true);
    await writeNext(selected, selectedModel || undefined);
    await loadNovels();
    setWriting(false);
  };

  const handleAutoStart = async () => {
    if (selected < 0) return;
    await autoStart(selected, selectedModel || undefined);
    setStatus((s) => ({ ...s, auto_running: true }));
  };

  const handleAutoStop = async () => {
    if (selected < 0) return;
    await autoStop(selected);
    setStatus((s) => ({ ...s, auto_running: false }));
    await loadNovels();
  };

  const handleCreateNovel = async (data: CreateNovelRequest) => {
    const result = await createNovel({ ...data, model: selectedModel || undefined });
    if (result.success) {
      setShowCreateModal(false);
      await loadNovels();
      if (result.index >= 0) {
        setSelected(result.index);
      }
    }
    return result;
  };

  const handleSelectNovel = (idx: number) => {
    setSelected(idx);
    setViewMode('dashboard');
  };

  const handleReadChapter = (num: number) => {
    setReadingChapter(num);
    setViewMode('reader');
  };

  const handleNavigateChapter = (num: number) => {
    setReadingChapter(num);
  };

  const handleBackFromReader = () => {
    setViewMode('dashboard');
  };

  const novel = selected >= 0 ? novels[selected] : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Novel-Lite Dashboard</h1>
        <ModelSelector
          status={ollamaStatus}
          selected={selectedModel}
          onSelect={setSelectedModel}
        />
      </header>

      <div className="app-body">
        <Sidebar
          novels={novels}
          selected={selected}
          onSelect={handleSelectNovel}
          onCreateNew={() => setShowCreateModal(true)}
        />

        <main className="main-area">
          {viewMode === 'reader' && novel ? (
            <ReaderView
              novelIdx={selected}
              chapterNum={readingChapter}
              totalChapters={novel.target_chapters}
              novelTitle={novel.title}
              onBack={handleBackFromReader}
              onNavigate={handleNavigateChapter}
            />
          ) : novel ? (
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
              <ChapterList
                chapters={chapters}
                writtenCount={novel.current_chapter}
                onSelect={handleReadChapter}
              />
              <LogPanel logs={logs} />
            </>
          ) : (
            <div className="empty-state">
              <p>未发现小说项目</p>
              <p className="hint">
                点击侧边栏 "+" 创建新小说
              </p>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <span>运行: {status.elapsed}</span>
        <span>|</span>
        <span>本会话: {status.session_chapters}章</span>
      </footer>

      {showCreateModal && (
        <CreateNovelModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateNovel}
        />
      )}
    </div>
  );
}

export default App;
