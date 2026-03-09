'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { WORKFLOW_STEPS, type WorkflowStatus } from '@/types';

interface WorkflowProgressProps {
  currentStatus: WorkflowStatus;
  onStatusChange?: (status: WorkflowStatus) => void;
}

export function WorkflowProgress({ currentStatus, onStatusChange }: WorkflowProgressProps) {
  const [hoveredStep, setHoveredStep] = useState<WorkflowStatus | null>(null);

  const currentIndex = WORKFLOW_STEPS.findIndex((step) => step.status === currentStatus);

  return (
    <div className="w-full">
      {/* 进度条容器 */}
      <div className="relative flex items-center justify-between px-2">
        {WORKFLOW_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const isHovered = hoveredStep === step.status;
          const isClickable = !!onStatusChange;

          return (
            <div
              key={step.status}
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHoveredStep(step.status)}
              onMouseLeave={() => setHoveredStep(null)}
            >
              {/* 连接线 - 左侧 */}
              {index > 0 && (
                <div
                  className={cn(
                    'absolute top-4 -left-[calc(50%-0.5rem)] right-1/2 h-0.5 -translate-y-1/2',
                    'transition-all duration-300',
                    index <= currentIndex
                      ? 'bg-gradient-to-r from-accent/80 to-accent'
                      : 'bg-ink/50'
                  )}
                  style={{ width: 'calc(50% - 1rem)' }}
                />
              )}

              {/* 连接线 - 右侧 */}
              {index < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={cn(
                    'absolute top-4 left-1/2 -right-[calc(50%-0.5rem)] h-0.5 -translate-y-1/2',
                    'transition-all duration-300',
                    index < currentIndex
                      ? 'bg-gradient-to-l from-ink/50 to-accent'
                      : 'bg-ink/50'
                  )}
                  style={{ width: 'calc(50% - 1rem)' }}
                />
              )}

              {/* 步骤圆点 */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => onStatusChange?.(step.status)}
                className={cn(
                  'relative z-10 w-8 h-8 rounded-full flex items-center justify-center',
                  'transition-all duration-200',
                  'border-2',
                  isCompleted && [
                    'bg-accent border-accent',
                    'text-white',
                  ],
                  isCurrent && [
                    'bg-accent/20 border-accent',
                    'text-accent',
                    'ring-2 ring-accent/30 ring-offset-2 ring-offset-background',
                  ],
                  isPending && [
                    'bg-surface border-ink/30',
                    'text-text-muted',
                  ],
                  isClickable && 'cursor-pointer hover:scale-110',
                  !isClickable && 'cursor-default'
                )}
                aria-label={`${step.label}: ${step.description}`}
              >
                {isCompleted ? (
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <span className={cn(
                    'text-xs font-medium',
                    isCurrent ? 'text-accent' : 'text-text-muted'
                  )}>
                    {index + 1}
                  </span>
                )}
              </button>

              {/* 步骤标签 */}
              <span
                className={cn(
                  'mt-2 text-xs font-medium whitespace-nowrap transition-all duration-200',
                  isCurrent && 'text-accent',
                  isCompleted && 'text-text-secondary',
                  isPending && 'text-text-muted'
                )}
              >
                {step.label}
              </span>

              {/* Tooltip */}
              {isHovered && (
                <div
                  className={cn(
                    'absolute bottom-full mb-2 left-1/2 -translate-x-1/2',
                    'px-3 py-1.5 rounded-lg',
                    'bg-surface/95 backdrop-blur-sm border border-white/10',
                    'text-xs text-text-secondary whitespace-nowrap',
                    'shadow-lg shadow-black/20',
                    'animate-in fade-in-0 zoom-in-95 duration-150',
                    'z-50'
                  )}
                  role="tooltip"
                >
                  {step.description}
                  <div
                    className={cn(
                      'absolute top-full left-1/2 -translate-x-1/2 -mt-1',
                      'border-4 border-transparent',
                      'border-t-surface/95'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 当前进度信息 */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <span className="text-text-muted text-sm">当前阶段：</span>
        <span className="text-accent font-medium text-sm">
          {WORKFLOW_STEPS[currentIndex]?.label}
        </span>
        <span className="text-text-muted text-sm">
          ({currentIndex + 1}/{WORKFLOW_STEPS.length})
        </span>
      </div>
    </div>
  );
}
