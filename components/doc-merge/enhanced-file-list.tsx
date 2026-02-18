'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMergeStore } from '@/lib/store';
import { FileItem } from './file-item';
import { EnhancedPasswordModal } from './enhanced-password-modal';
import { UploadedFile } from '@/lib/types';

const ITEMS_PER_PAGE = 10;

export function EnhancedFileList() {
  const files = useMergeStore((state) => state.files);
  const reorderFiles = useMergeStore((state) => state.reorderFiles);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayedCount < files.length) {
          setDisplayedCount((prev) => Math.min(prev + ITEMS_PER_PAGE, files.length));
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [displayedCount, files.length]);

  const displayedFiles = files.slice(0, displayedCount);

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
        <p className="text-sm text-gray-500">No files uploaded yet</p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedFileId(fileId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetFileId: string) => {
    e.preventDefault();
    if (!draggedFileId || draggedFileId === targetFileId) {
      setDraggedFileId(null);
      return;
    }

    const draggedIndex = files.findIndex((f) => f.id === draggedFileId);
    const targetIndex = files.findIndex((f) => f.id === targetFileId);

    const newFiles = [...files];
    const [draggedFile] = newFiles.splice(draggedIndex, 1);
    newFiles.splice(targetIndex, 0, draggedFile);

    const reorderedFiles = newFiles.map((f, idx) => ({ ...f, order: idx }));
    reorderFiles(reorderedFiles);
    setDraggedFileId(null);
  };

  const handleDragEnd = () => {
    setDraggedFileId(null);
  };

  const handleOrderChange = (fileId: string, newOrder: string) => {
    const orderNum = parseInt(newOrder, 10);
    
    if (isNaN(orderNum) || orderNum < 1 || orderNum > files.length) {
      return;
    }

    const currentIndex = files.findIndex((f) => f.id === fileId);
    const newIndex = orderNum - 1;

    if (currentIndex === newIndex) {
      setEditingOrderId(null);
      return;
    }

    const newFiles = [...files];
    const [movedFile] = newFiles.splice(currentIndex, 1);
    newFiles.splice(newIndex, 0, movedFile);

    const reorderedFiles = newFiles.map((f, idx) => ({ ...f, order: idx }));
    reorderFiles(reorderedFiles);
    setEditingOrderId(null);
  };

  const handleOrderInputBlur = (fileId: string) => {
    if (editingValue) {
      handleOrderChange(fileId, editingValue);
    }
    setEditingOrderId(null);
  };

  const handleOrderInputKeyDown = (
    e: React.KeyboardEvent,
    fileId: string
  ) => {
    if (e.key === 'Enter') {
      handleOrderChange(fileId, editingValue);
    } else if (e.key === 'Escape') {
      setEditingOrderId(null);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {/* File count indicator for large lists */}
        {files.length > 20 && (
          <div className="text-xs text-gray-500 flex items-center justify-between px-2">
            <span>Showing {displayedFiles.length} of {files.length} files</span>
            {displayedFiles.length < files.length && (
              <span>↓ Scroll to load more</span>
            )}
          </div>
        )}

        {displayedFiles.map((file, index) => (
          <div
            key={file.id}
            draggable
            onDragStart={(e) => handleDragStart(e, file.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, file.id)}
            onDragEnd={handleDragEnd}
            className="flex items-center gap-3"
          >
            {/* Order number field */}
            {editingOrderId === file.id ? (
              <div className="flex-shrink-0 w-12">
                <input
                  type="number"
                  min="1"
                  max={files.length}
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => handleOrderInputBlur(file.id)}
                  onKeyDown={(e) => handleOrderInputKeyDown(e, file.id)}
                  autoFocus
                  className="w-full h-9 px-2 border border-blue-500 rounded text-sm font-medium text-center bg-blue-50"
                />
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingOrderId(file.id);
                  setEditingValue(String(index + 1));
                }}
                className="flex-shrink-0 w-12 h-9 flex items-center justify-center text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-400 transition-colors cursor-text"
                title="Click to edit order"
              >
                {index + 1}
              </button>
            )}

            <div className="flex-1">
              <FileItem
                file={file}
                isDragging={draggedFileId === file.id}
                onPasswordClick={() => setSelectedFileId(file.id)}
              />
            </div>
          </div>
        ))}

        {/* Infinite scroll trigger */}
        {displayedCount < files.length && (
          <div
            ref={observerTarget}
            className="py-4 text-center text-xs text-gray-400"
          >
            Loading more files...
          </div>
        )}
      </div>

      {selectedFileId && (
        <EnhancedPasswordModal
          file={files.find((f) => f.id === selectedFileId)!}
          onClose={() => setSelectedFileId(null)}
        />
      )}
    </>
  );
}
