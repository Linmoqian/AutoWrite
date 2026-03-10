'use client';

import { useRouter } from 'next/navigation';
import { useKanbanStore } from '@/store';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  PenTool,
  Sparkles,
  Plus,
  FileText,
  Users,
  Target,
  Scroll,
} from 'lucide-react';
import { cn, formatDate, formatWordCount } from '@/lib/utils';
import { GENRE_OPTIONS, WORKFLOW_STEPS, type Novel } from '@/types';

export default function NovelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { novels, getChaptersByNovelId } = useKanbanStore();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [novelId, setNovelId] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => {
      setNovelId(resolved.id);
    });
  }, [params]);

  useEffect(() => {
    if (novelId) {
      const found = novels.find((n) => n.id === novelId);
      setNovel(found || null);
    }
  }, [novelId, novels]);

  if (!novel) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center relative">
        <div className="paper-texture" aria-hidden="true" />
        <div className="text-center relative z-10">
          <Scroll size={48} className="mx-auto text-text-muted mb-4 opacity-60" />
          <p className="text-text-muted tracking-wide">作品不存在或正在加载中...</p>
          <button
            onClick={() => router.push('/')}
            className={cn(
              'mt-6 px-5 py-2.5 rounded-xl text-sm',
              'bg-surface/80 border border-border',
              'text-text-primary hover:bg-surface',
              'transition-all duration-200'
            )}
          >
            返回书斋
          </button>
        </div>
      </div>
    );
  }

  const genreLabel = GENRE_OPTIONS.find((g) => g.value === novel.genre)?.label || novel.genre;
  const progress = Math.min(100, Math.max(0, (novel.writtenChapters / novel.targetChapters) * 100));
  const novelChapters = getChaptersByNovelId(novel.id);
  const currentWorkflowStep = WORKFLOW_STEPS.findIndex((s) => s.status === novel.workflowStatus);

  return (
    <div className="min-h-screen bg-void p-8 relative">
      {/* 背景纹理 */}
      <div className="paper-texture" aria-hidden="true" />

      {/* 顶部导航栏 */}
      <header className="mb-8 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className={cn(
                'p-3 rounded-xl transition-all duration-200',
                'bg-surface/60 border border-border',
                'hover:bg-surface/80 hover:border-border-hover',
                'text-text-muted hover:text-text-primary'
              )}
              aria-label="返回书斋"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-text-primary tracking-wider font-display">
                {novel.title}
              </h1>
              <p className="text-sm text-text-muted mt-1 flex items-center gap-2">
                <span className="w-6 h-px bg-gradient-to-r from-gold to-transparent" />
                小说详情与创作管理
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className={cn(
                'btn-primary px-5 py-2.5 rounded-xl text-sm font-medium',
                'text-white',
                'flex items-center gap-2'
              )}
            >
              <PenTool size={16} aria-hidden="true" />
              继续创作
            </button>
            <button
              className={cn(
                'btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium',
                'text-amber-950',
                'flex items-center gap-2'
              )}
            >
              <Sparkles size={16} aria-hidden="true" />
              AI 辅助
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* 左侧：小说基本信息 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 基本信息卡片 */}
          <div className={cn(
            'bg-surface/80 backdrop-blur-sm rounded-2xl border border-border p-6',
            'relative overflow-hidden'
          )}>
            {/* 装饰角 */}
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold/25" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-gold/25" />

            <h2 className="text-lg font-semibold text-text-primary mb-5 flex items-center gap-2 tracking-wide">
              <Scroll size={18} className="text-accent" aria-hidden="true" />
              基本信息
            </h2>

            <div className="space-y-4">
              <InfoRow label="类型" value={genreLabel} />
              <InfoRow label="主题" value={novel.theme} />
              <InfoRow label="进度" value={`${novel.writtenChapters} / ${novel.targetChapters} 章`} />
              <InfoRow label="总字数" value={formatWordCount(novel.wordCount)} />
              <InfoRow label="创建时间" value={formatDate(novel.createdAt)} />
              <InfoRow label="更新时间" value={formatDate(novel.updatedAt)} />
            </div>

            {/* 进度条 */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-text-muted">创作进度</span>
                <span className="text-text-secondary font-medium">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-ink/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full progress-bar bg-gradient-to-r from-accent to-gold transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* 简介卡片 */}
          {novel.description && (
            <div className={cn(
              'bg-surface/80 backdrop-blur-sm rounded-2xl border border-border p-6',
              'relative'
            )}>
              <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold/25" />
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 tracking-wide">
                <FileText size={18} className="text-gold" aria-hidden="true" />
                小说简介
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed">{novel.description}</p>
            </div>
          )}
        </div>

        {/* 右侧：工作流和章节 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 工作流进度 */}
          <div className={cn(
            'bg-surface/80 backdrop-blur-sm rounded-2xl border border-border p-6',
            'relative'
          )}>
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold/25" />
            <h2 className="text-lg font-semibold text-text-primary mb-5 flex items-center gap-2 tracking-wide">
              <Target size={18} className="text-gold" aria-hidden="true" />
              工作流进度
            </h2>

            {/* 工作流步骤 */}
            <div className="flex items-center justify-between relative py-2">
              {WORKFLOW_STEPS.map((step, index) => {
                const isActive = index === currentWorkflowStep;
                const isCompleted = index < currentWorkflowStep;

                return (
                  <div key={step.status} className="flex flex-col items-center relative z-10">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                        isCompleted && 'bg-emerald-500/15 text-emerald-400 border-2 border-emerald-500/40',
                        isActive && 'bg-accent/15 text-accent border-2 border-accent/40 status-pulse',
                        !isCompleted && !isActive && 'bg-ink/40 text-text-muted border-2 border-border'
                      )}
                    >
                      {index + 1}
                    </div>
                    <span
                      className={cn(
                        'mt-2 text-xs text-center max-w-[64px] leading-tight',
                        isActive ? 'text-text-primary font-medium' : 'text-text-muted'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}

              {/* 连接线 */}
              <div className="absolute top-[30px] left-0 right-0 h-0.5 bg-border -z-0" />
              <div
                className="absolute top-[30px] left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-accent transition-all duration-500 -z-0"
                style={{ width: `${(currentWorkflowStep / (WORKFLOW_STEPS.length - 1)) * 100}%` }}
              />
            </div>

            {/* 当前状态描述 */}
            <div className="mt-5 p-4 rounded-xl bg-ink/30 border border-border">
              <p className="text-sm text-text-secondary">
                当前阶段：
                <span className="text-accent font-semibold ml-1.5">
                  {WORKFLOW_STEPS[currentWorkflowStep]?.label || '未知'}
                </span>
                <span className="text-text-muted ml-2">
                  — {WORKFLOW_STEPS[currentWorkflowStep]?.description || ''}
                </span>
              </p>
            </div>
          </div>

          {/* 章节列表 */}
          <div className={cn(
            'bg-surface/80 backdrop-blur-sm rounded-2xl border border-border p-6',
            'relative'
          )}>
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold/25" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 tracking-wide">
                <FileText size={18} className="text-gold" aria-hidden="true" />
                章节列表
                <span className="text-sm font-normal text-text-muted ml-2">
                  ({novelChapters.length} 章)
                </span>
              </h2>
              <button
                className={cn(
                  'px-3.5 py-1.5 rounded-lg transition-all duration-200',
                  'bg-accent/10 text-accent border border-accent/20',
                  'hover:bg-accent/20',
                  'flex items-center gap-1.5 text-sm'
                )}
              >
                <Plus size={14} aria-hidden="true" />
                添加章节
              </button>
            </div>

            {novelChapters.length > 0 ? (
              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {novelChapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className={cn(
                      'p-3.5 rounded-xl transition-all duration-200',
                      'bg-ink/30 border border-border',
                      'hover:bg-ink/50 hover:border-border-hover',
                      'cursor-pointer'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted text-sm">第 {chapter.number} 章</span>
                        <span className="text-text-primary font-medium">{chapter.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-muted">{formatWordCount(chapter.wordCount)}</span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            chapter.status === 'finalized' && 'bg-emerald-500/15 text-emerald-400',
                            chapter.status === 'reviewing' && 'bg-amber-500/15 text-amber-400',
                            chapter.status === 'draft' && 'bg-sky-500/15 text-sky-400'
                          )}
                        >
                          {chapter.status === 'finalized' && '已定稿'}
                          {chapter.status === 'reviewing' && '审核中'}
                          {chapter.status === 'draft' && '草稿'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <FileText size={40} className="mx-auto text-text-muted mb-4 opacity-40" />
                <p className="text-text-muted">暂无章节</p>
                <p className="text-text-muted text-sm mt-2">点击上方按钮开始创作第一章</p>
              </div>
            )}
          </div>

          {/* 角色列表（占位） */}
          <div className={cn(
            'bg-surface/80 backdrop-blur-sm rounded-2xl border border-border p-6',
            'relative'
          )}>
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold/25" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 tracking-wide">
                <Users size={18} className="text-gold" aria-hidden="true" />
                角色管理
              </h2>
              <button
                className={cn(
                  'px-3.5 py-1.5 rounded-lg transition-all duration-200',
                  'bg-accent/10 text-accent border border-accent/20',
                  'hover:bg-accent/20',
                  'flex items-center gap-1.5 text-sm'
                )}
              >
                <Plus size={14} aria-hidden="true" />
                添加角色
              </button>
            </div>

            <div className="py-10 text-center">
              <Users size={40} className="mx-auto text-text-muted mb-4 opacity-40" />
              <p className="text-text-muted">角色管理功能开发中...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 信息行组件
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-text-muted text-sm">{label}</span>
      <span className="text-text-secondary font-medium">{value}</span>
    </div>
  );
}
