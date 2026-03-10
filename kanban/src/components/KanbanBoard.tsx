'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useKanbanStore } from '@/store';
import { STATUS_ORDER, NovelStatus, type Novel } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { SearchFilter } from './SearchFilter';
import { NovelModal } from './NovelModal';
import { cn } from '@/lib/utils';

export function KanbanBoard() {
  const {
    novels,
    searchQuery,
    selectedGenre,
    moveNovel,
    setSearchQuery,
    setSelectedGenre,
    addNovel,
    updateNovel,
    deleteNovel,
  } = useKanbanStore();

  const [activeNovel, setActiveNovel] = useState<Novel | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<NovelStatus>(NovelStatus.TODO);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filteredNovels = useMemo(() => {
    return novels.filter((novel) => {
      const matchesSearch = novel.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = !selectedGenre || novel.genre === selectedGenre;
      return matchesSearch && matchesGenre;
    });
  }, [novels, searchQuery, selectedGenre]);

  const novelsByStatus = useMemo(() => {
    const grouped: Record<NovelStatus, Novel[]> = {
      [NovelStatus.TODO]: [],
      [NovelStatus.WRITING]: [],
      [NovelStatus.REVIEWING]: [],
      [NovelStatus.PUBLISHED]: [],
    };
    filteredNovels.forEach((novel) => {
      grouped[novel.status].push(novel);
    });
    return grouped;
  }, [filteredNovels]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const novel = novels.find((n) => n.id === event.active.id);
    if (novel) setActiveNovel(novel);
  }, [novels]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { over } = event;
    setActiveNovel(null);
    if (over && STATUS_ORDER.includes(over.id as NovelStatus)) {
      moveNovel(event.active.id as string, over.id as NovelStatus);
    }
  }, [moveNovel]);

  const handleAddNovel = useCallback((status: NovelStatus) => {
    setEditingNovel(null);
    setDefaultStatus(status);
    setModalOpen(true);
  }, []);

  const handleEditNovel = useCallback((novel: Novel) => {
    setEditingNovel(novel);
    setModalOpen(true);
  }, []);

  const handleDeleteNovel = useCallback((novelId: string) => {
    const novel = novels.find((n) => n.id === novelId);
    if (confirm(`确定要删除《${novel?.title}》吗？此操作不可撤销。`)) {
      deleteNovel(novelId);
    }
  }, [novels, deleteNovel]);

  const handleSaveNovel = useCallback((novel: Novel) => {
    if (editingNovel) {
      updateNovel(novel);
    } else {
      addNovel(novel);
    }
  }, [editingNovel, updateNovel, addNovel]);

  return (
    <main className="h-full flex flex-col p-6 relative z-10">
      {/* 搜索筛选 */}
      <SearchFilter
        searchQuery={searchQuery}
        selectedGenre={selectedGenre}
        onSearchChange={setSearchQuery}
        onGenreChange={setSelectedGenre}
      />

      {/* 看板主体 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 px-1">
          {STATUS_ORDER.map((status, index) => (
            <div
              key={status}
              className="card-enter"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <KanbanColumn
                id={status}
                novels={novelsByStatus[status]}
                onAddNovel={handleAddNovel}
                onEditNovel={handleEditNovel}
                onDeleteNovel={handleDeleteNovel}
              />
            </div>
          ))}
        </div>

        {/* 拖拽浮层 */}
        <DragOverlay>
          {activeNovel && (
            <div className="rotate-3 scale-105">
              <div className={cn(
                'bg-surface/95 backdrop-blur-xl rounded-2xl p-4 border-2',
                'shadow-2xl shadow-purple-500/30',
                'border-accent'
              )}>
                <h3 className="font-semibold text-text-primary">{activeNovel.title}</h3>
                <p className="text-sm text-text-secondary mt-1">{activeNovel.theme}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* 模态框 */}
      <NovelModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveNovel}
        novel={editingNovel}
        defaultStatus={defaultStatus}
      />
    </main>
  );
}
