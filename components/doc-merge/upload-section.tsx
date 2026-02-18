"use client";

import { useState, useRef } from "react";
import { Upload, Camera } from "lucide-react";
import { useMergeStore } from "@/lib/store";
import { isValidFileType } from "@/lib/file-utils";
import { Button } from "@/components/ui/button";

export function UploadSection() {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const addFiles = useMergeStore((state) => state.addFiles);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
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
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div
      className={`relative w-full rounded-xl border-2 border-dashed transition-colors ${
        dragActive
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 bg-white hover:border-gray-400"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {/* Standard file picker input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleChange}
        className="hidden"
      />

      {/* Native camera capture input - opens device camera directly on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center gap-4 px-6 py-12">
        <div className="rounded-full bg-blue-100 p-3">
          <Upload className="h-6 w-6 text-blue-600" />
        </div>

        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Upload your files
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Drag and drop PDFs, JPGs, or PNGs here
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={handleClick}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Select Files
          </Button>

          <Button
            onClick={handleCameraClick}
            variant="outline"
            className="border-teal-500 text-teal-600 hover:bg-teal-50"
          >
            <Camera className="mr-2 h-4 w-4" />
            Use Camera
          </Button>
        </div>

        <p className="text-xs text-gray-400">
          Supported formats: PDF, JPG, PNG
        </p>
      </div>
    </div>
  );
}
