'use client';

import { useState, useMemo } from 'react';
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
import { STATUS_ORDER, type Novel, type NovelStatus } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { SearchFilter } from './SearchFilter';
import { NovelModal } from './NovelModal';

export function KanbanBoard() {
  const { novels, searchQuery, selectedGenre, moveNovel, setSearchQuery, setSelectedGenre, addNovel, updateNovel, deleteNovel } = useKanbanStore();
  const [activeNovel, setActiveNovel] = useState<Novel | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<NovelStatus>('todo');

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
    const grouped: Record<NovelStatus, Novel[]> = { todo: [], writing: [], reviewing: [], published: [] };
    filteredNovels.forEach((novel) => { grouped[novel.status].push(novel); });
    return grouped;
  }, [filteredNovels]);

  const handleDragStart = (event: DragStartEvent) => {
    const novel = novels.find((n) => n.id === event.active.id);
    if (novel) setActiveNovel(novel);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    setActiveNovel(null);
    if (over && STATUS_ORDER.includes(over.id as NovelStatus)) {
      moveNovel(event.active.id as string, over.id as NovelStatus);
    }
  };

  const handleAddNovel = (status: NovelStatus) => {
    setEditingNovel(null);
    setDefaultStatus(status);
    setModalOpen(true);
  };

  const handleEditNovel = (novel: Novel) => {
    setEditingNovel(novel);
    setModalOpen(true);
  };

  const handleDeleteNovel = (novelId: string) => {
    if (confirm('确定要删除这本小说吗？')) deleteNovel(novelId);
  };

  const handleSaveNovel = (novel: Novel) => {
    if (editingNovel) updateNovel(novel);
    else addNovel(novel);
  };

  return (
    <div className="h-full flex flex-col">
      <SearchFilter searchQuery={searchQuery} selectedGenre={selectedGenre} onSearchChange={setSearchQuery} onGenreChange={setSelectedGenre} />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
          {STATUS_ORDER.map((status) => (
            <KanbanColumn key={status} id={status} novels={novelsByStatus[status]} onAddNovel={handleAddNovel} onEditNovel={handleEditNovel} onDeleteNovel={handleDeleteNovel} />
          ))}
        </div>
        <DragOverlay>
          {activeNovel && (
            <div className="rotate-3">
              <div className="bg-slate-800 rounded-lg p-4 border border-blue-500 shadow-xl">
                <h3 className="font-medium text-white">{activeNovel.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{activeNovel.theme}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <NovelModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveNovel} novel={editingNovel} defaultStatus={defaultStatus} />
    </div>
  );
}
