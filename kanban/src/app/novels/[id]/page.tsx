'use client';

import { useRouter } from 'next/navigation';
import { useKanbanStore } from '@/store';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  PenTool,
  Sparkles,
  Plus,
  FileText,
  Users,
  Calendar,
  Target,
} from 'lucide-react';
import { cn, formatDate, formatWordCount } from '@/lib/utils';
import { GENRE_OPTIONS, WORKFLOW_STEPS, type Novel } from '@/types';

export default function NovelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { novels, chapters, getChaptersByNovelId } = useKanbanStore();
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
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-muted">小说不存在或正在加载中...</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-surface/80 rounded-lg text-text-primary hover:bg-surface transition-colors"
          >
            返回首页
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
    <div className="min-h-screen bg-void p-8">
      {/* 顶部导航栏 */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className={cn(
                'p-3 rounded-xl transition-all duration-200',
                'bg-surface/80 border border-white/5',
                'hover:bg-surface hover:border-white/10',
                'text-text-muted hover:text-text-primary'
              )}
              aria-label="返回首页"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">{novel.title}</h1>
              <p className="text-sm text-text-muted mt-1">小说详情与创作管理</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className={cn(
                'px-4 py-2.5 rounded-xl transition-all duration-200',
                'bg-gradient-to-r from-purple-500 to-blue-600',
                'text-white font-medium',
                'hover:shadow-lg hover:shadow-purple-500/25',
                'flex items-center gap-2'
              )}
            >
              <PenTool size={16} aria-hidden="true" />
              继续创作
            </button>
            <button
              className={cn(
                'px-4 py-2.5 rounded-xl transition-all duration-200',
                'bg-surface/80 border border-white/5',
                'text-text-primary font-medium',
                'hover:bg-surface hover:border-white/10',
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：小说基本信息 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 基本信息卡片 */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-accent" aria-hidden="true" />
              基本信息
            </h2>

            <div className="space-y-4">
              <InfoRow label="类型" value={genreLabel} />
              <InfoRow label="主题" value={novel.theme} />
              <InfoRow
                label="进度"
                value={`${novel.writtenChapters} / ${novel.targetChapters} 章`}
              />
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
              <div className="h-2 bg-ink/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* 简介卡片 */}
          {novel.description && (
            <div className="bg-surface/80 backdrop-blur-sm rounded-2xl border border-white/5 p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <FileText size={18} className="text-accent" aria-hidden="true" />
                小说简介
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed">{novel.description}</p>
            </div>
          )}
        </div>

        {/* 右侧：工作流和章节 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 工作流进度 */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Target size={18} className="text-accent" aria-hidden="true" />
              工作流进度
            </h2>

            {/* 工作流步骤 */}
            <div className="flex items-center justify-between relative">
              {WORKFLOW_STEPS.map((step, index) => {
                const isActive = index === currentWorkflowStep;
                const isCompleted = index < currentWorkflowStep;

                return (
                  <div key={step.status} className="flex flex-col items-center relative z-10">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                        isCompleted && 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50',
                        isActive && 'bg-purple-500/20 text-purple-400 border-2 border-purple-500/50 animate-pulse',
                        !isCompleted && !isActive && 'bg-ink/50 text-text-muted border-2 border-white/5'
                      )}
                    >
                      {index + 1}
                    </div>
                    <span
                      className={cn(
                        'mt-2 text-xs text-center max-w-[60px]',
                        isActive ? 'text-text-primary font-medium' : 'text-text-muted'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}

              {/* 连接线 */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-ink/50 -z-0" />
              <div
                className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-purple-500 transition-all duration-500 -z-0"
                style={{ width: `${(currentWorkflowStep / (WORKFLOW_STEPS.length - 1)) * 100}%` }}
              />
            </div>

            {/* 当前状态描述 */}
            <div className="mt-4 p-3 rounded-xl bg-ink/30 border border-white/5">
              <p className="text-sm text-text-secondary">
                当前阶段：
                <span className="text-accent font-medium ml-1">
                  {WORKFLOW_STEPS[currentWorkflowStep]?.label || '未知'}
                </span>
                <span className="text-text-muted ml-2">
                  - {WORKFLOW_STEPS[currentWorkflowStep]?.description || ''}
                </span>
              </p>
            </div>
          </div>

          {/* 章节列表 */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <FileText size={18} className="text-accent" aria-hidden="true" />
                章节列表
                <span className="text-sm font-normal text-text-muted ml-2">
                  ({novelChapters.length} 章)
                </span>
              </h2>
              <button
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all duration-200',
                  'bg-purple-500/20 text-purple-400',
                  'hover:bg-purple-500/30',
                  'flex items-center gap-1.5 text-sm'
                )}
              >
                <Plus size={14} aria-hidden="true" />
                添加章节
              </button>
            </div>

            {novelChapters.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {novelChapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className={cn(
                      'p-3 rounded-xl transition-all duration-200',
                      'bg-ink/30 border border-white/5',
                      'hover:bg-ink/50 hover:border-white/10',
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
                            'px-2 py-0.5 rounded-full text-xs',
                            chapter.status === 'finalized' && 'bg-emerald-500/20 text-emerald-400',
                            chapter.status === 'reviewing' && 'bg-amber-500/20 text-amber-400',
                            chapter.status === 'draft' && 'bg-blue-500/20 text-blue-400'
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
                <FileText size={40} className="mx-auto text-text-muted mb-3 opacity-50" />
                <p className="text-text-muted">暂无章节</p>
                <p className="text-text-muted text-sm mt-1">点击上方按钮开始创作第一章</p>
              </div>
            )}
          </div>

          {/* 角色列表（占位） */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Users size={18} className="text-accent" aria-hidden="true" />
                角色管理
              </h2>
              <button
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all duration-200',
                  'bg-purple-500/20 text-purple-400',
                  'hover:bg-purple-500/30',
                  'flex items-center gap-1.5 text-sm'
                )}
              >
                <Plus size={14} aria-hidden="true" />
                添加角色
              </button>
            </div>

            <div className="py-8 text-center">
              <Users size={40} className="mx-auto text-text-muted mb-3 opacity-50" />
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
    <div className="flex items-center justify-between">
      <span className="text-text-muted text-sm">{label}</span>
      <span className="text-text-secondary font-medium">{value}</span>
    </div>
  );
}
