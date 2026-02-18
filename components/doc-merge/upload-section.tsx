'use client';

import { useState, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { useMergeStore } from '@/lib/store';
import { isValidFileType } from '@/lib/file-utils';
import { Button } from '@/components/ui/button';

export function UploadSection() {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFiles = useMergeStore((state) => state.addFiles);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(isValidFileType);
    if (files.length > 0) {
      addFiles(files as File[]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(isValidFileType);
      if (files.length > 0) {
        addFiles(files as File[]);
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`relative w-full rounded-xl border-2 border-dashed transition-colors ${
        dragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center gap-4 px-6 py-12">
        <div className="rounded-full bg-blue-100 p-3">
          <Upload className="h-6 w-6 text-blue-600" />
        </div>

        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">Upload your files</h3>
          <p className="mt-1 text-sm text-gray-500">
            Drag and drop PDFs, JPGs, or PNGs here
          </p>
        </div>

        <Button
          onClick={handleClick}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Select Files
        </Button>

        <p className="text-xs text-gray-400">
          Supported formats: PDF, JPG, PNG
        </p>
      </div>
    </div>
  );
}
