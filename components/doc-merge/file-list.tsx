'use client';

import { useState } from 'react';
import { useMergeStore } from '@/lib/store';
import { FileItem } from './file-item';
import { PasswordModal } from './password-modal';
import { UploadedFile } from '@/lib/types';

export function FileList() {
  const files = useMergeStore((state) => state.files);
  const reorderFiles = useMergeStore((state) => state.reorderFiles);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);

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

  return (
    <>
      <div className="space-y-3">
        {files.map((file) => (
          <div
            key={file.id}
            draggable
            onDragStart={(e) => handleDragStart(e, file.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, file.id)}
            onDragEnd={handleDragEnd}
          >
            <FileItem
              file={file}
              isDragging={draggedFileId === file.id}
              onPasswordClick={() => setSelectedFileId(file.id)}
            />
          </div>
        ))}
      </div>

      {selectedFileId && (
        <PasswordModal
          file={files.find((f) => f.id === selectedFileId)!}
          onClose={() => setSelectedFileId(null)}
        />
      )}
    </>
  );
}
