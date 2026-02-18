"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  FileText,
  Image,
  Trash2,
  Lock,
  LockOpen,
  GripVertical,
  Search,
  Grid3X3,
  List,
  Camera,
  X,
  Filter,
  SortAsc,
  SortDesc,
  CheckCircle2,
  Eye,
  RotateCw,
} from "lucide-react";
import { useMergeStore } from "@/lib/store";
import { isValidFileType, formatFileSize } from "@/lib/file-utils";
import { UploadedFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EnhancedPasswordModal } from "./enhanced-password-modal";
import * as pdfjsLib from "pdfjs-dist";

// Set up PDF.js worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

type ViewMode = "list" | "grid";
type SortBy = "name" | "size" | "type" | "order";
type SortOrder = "asc" | "desc";

export function FileManager() {
  const files = useMergeStore((state) => state.files);
  const addFiles = useMergeStore((state) => state.addFiles);
  const removeFile = useMergeStore((state) => state.removeFile);
  const reorderFiles = useMergeStore((state) => state.reorderFiles);
  const updateFileRotation = useMergeStore((state) => state.updateFileRotation);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("order");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Drag state
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Password modal state
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Selection state for batch operations
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Thumbnail state - stores generated thumbnails by file id
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const generatedThumbnailsRef = useRef<Set<string>>(new Set());

  // Generate thumbnails for files
  const generateThumbnail = useCallback(
    async (file: UploadedFile): Promise<string | null> => {
      try {
        if (file.type === "image") {
          // For images, create an object URL directly
          return URL.createObjectURL(file.file);
        } else if (file.type === "pdf") {
          // Skip password-protected PDFs without valid password
          if (file.isPasswordProtected && !file.password) {
            return null;
          }

          // For PDFs, render the first page
          const arrayBuffer = await file.file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            password: file.password || undefined,
          });

          const pdf = await loadingTask.promise;

          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnail

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const ctx = canvas.getContext("2d");
          if (!ctx) return null;

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;

          return canvas.toDataURL("image/jpeg", 0.7);
        }
      } catch (error: any) {
        // Silently handle password exceptions - these are expected for protected PDFs
        if (error?.name === "PasswordException") {
          return null;
        }
        console.error("Failed to generate thumbnail:", error);
      }
      return null;
    },
    [],
  );

  // Generate thumbnails when files change
  useEffect(() => {
    const generateAllThumbnails = async () => {
      for (const file of files) {
        // Skip password-protected PDFs without password
        if (file.type === "pdf" && file.isPasswordProtected && !file.password)
          continue;

        // Create a key that includes password state for PDFs
        const thumbnailKey = file.isPasswordProtected
          ? `${file.id}-${file.password ? "unlocked" : "locked"}`
          : file.id;

        // Skip if already generating or generated with current state
        if (generatedThumbnailsRef.current.has(thumbnailKey)) continue;

        // Mark as being generated
        generatedThumbnailsRef.current.add(thumbnailKey);

        const thumbnail = await generateThumbnail(file);
        if (thumbnail) {
          setThumbnails((prev) => ({ ...prev, [file.id]: thumbnail }));
        }
      }
    };

    generateAllThumbnails();
  }, [files, generateThumbnail]);

  // Cleanup blob URLs on unmount only
  useEffect(() => {
    return () => {
      Object.values(thumbnails).forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter and sort files
  const filteredFiles = files
    .filter((file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "order":
        default:
          comparison = a.order - b.order;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Native camera handler - opens device camera directly on mobile
  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  // File upload handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      isValidFileType,
    );
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles as File[]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(isValidFileType);
      if (selectedFiles.length > 0) {
        addFiles(selectedFiles as File[]);
      }
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  // Drag and drop reordering
  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedFileId(fileId);
  };

  const handleDragOver = (e: React.DragEvent, fileId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFileId(fileId);
  };

  const handleDragLeave = () => {
    setDragOverFileId(null);
  };

  const handleDropReorder = (e: React.DragEvent, targetFileId: string) => {
    e.preventDefault();
    if (!draggedFileId || draggedFileId === targetFileId) {
      setDraggedFileId(null);
      setDragOverFileId(null);
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
    setDragOverFileId(null);
  };

  const handleDragEnd = () => {
    setDraggedFileId(null);
    setDragOverFileId(null);
  };

  // Rotate image handler - rotates 90 degrees clockwise
  const handleRotate = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file && file.type === "image") {
      const currentRotation = file.rotation || 0;
      const newRotation = (currentRotation + 90) % 360;
      updateFileRotation(fileId, newRotation);
    }
  };

  // Selection handlers
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  const deleteSelected = () => {
    selectedFiles.forEach((id) => removeFile(id));
    setSelectedFiles(new Set());
  };

  // Toggle sort order
  const toggleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("asc");
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className="relative w-full rounded-xl border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-blue-400"
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
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Native camera capture input - opens device camera directly on mobile */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-4 px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-3">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <Camera className="h-6 w-6 text-green-600" />
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Upload your documents
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Drag & drop or use buttons below
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="mr-2 h-4 w-4" />
              Select Files
            </Button>
            <Button
              onClick={handleCameraClick}
              variant="outline"
              className="border-green-500 text-green-600 hover:bg-green-50"
            >
              <Camera className="mr-2 h-4 w-4" />
              Use Camera
            </Button>
          </div>

          <p className="text-xs text-gray-400">Supported: PDF, JPG, PNG</p>
        </div>
      </div>

      {/* File Manager Controls */}
      {files.length > 0 && (
        <div className="space-y-3">
          {/* Search and View Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* View Toggle and Sort */}
            <div className="flex items-center gap-2">
              <Select
                value={sortBy}
                onValueChange={(value: SortBy) => toggleSort(value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Order</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>

              <div className="flex rounded-lg border border-gray-200 p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === "list"
                      ? "bg-blue-100 text-blue-600"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === "grid"
                      ? "bg-blue-100 text-blue-600"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  title="Grid view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Batch Actions */}
          {selectedFiles.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2">
              <span className="text-sm font-medium text-blue-700">
                {selectedFiles.size} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-blue-600 hover:bg-blue-100"
              >
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteSelected}
                className="text-red-600 hover:bg-red-100"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}

          {/* File Count */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {filteredFiles.length} of {files.length} files
              {searchQuery && " (filtered)"}
            </span>
            {files.length > 1 && (
              <button
                onClick={
                  selectedFiles.size === filteredFiles.length
                    ? clearSelection
                    : selectAll
                }
                className="text-blue-600 hover:text-blue-700"
              >
                {selectedFiles.size === filteredFiles.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            )}
          </div>

          {/* File List/Grid */}
          {viewMode === "list" ? (
            <div className="space-y-2">
              {filteredFiles.map((file, index) => (
                <ListFileItem
                  key={file.id}
                  file={file}
                  index={index}
                  isSelected={selectedFiles.has(file.id)}
                  isDragging={draggedFileId === file.id}
                  isDragOver={dragOverFileId === file.id}
                  onSelect={() => toggleFileSelection(file.id)}
                  onDelete={() => removeFile(file.id)}
                  onPasswordClick={() => setSelectedFileId(file.id)}
                  onRotate={
                    file.type === "image"
                      ? () => handleRotate(file.id)
                      : undefined
                  }
                  onDragStart={(e) => handleDragStart(e, file.id)}
                  onDragOver={(e) => handleDragOver(e, file.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropReorder(e, file.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredFiles.map((file, index) => (
                <GridFileItem
                  key={file.id}
                  file={file}
                  index={index}
                  isSelected={selectedFiles.has(file.id)}
                  isDragging={draggedFileId === file.id}
                  isDragOver={dragOverFileId === file.id}
                  thumbnail={thumbnails[file.id]}
                  onSelect={() => toggleFileSelection(file.id)}
                  onDelete={() => removeFile(file.id)}
                  onPasswordClick={() => setSelectedFileId(file.id)}
                  onRotate={
                    file.type === "image"
                      ? () => handleRotate(file.id)
                      : undefined
                  }
                  onDragStart={(e) => handleDragStart(e, file.id)}
                  onDragOver={(e) => handleDragOver(e, file.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropReorder(e, file.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}

          {/* No results */}
          {filteredFiles.length === 0 && searchQuery && (
            <div className="py-8 text-center text-gray-500">
              <Search className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2">No files match "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      )}

      {/* Password Modal */}
      {selectedFileId && (
        <EnhancedPasswordModal
          file={files.find((f) => f.id === selectedFileId)!}
          onClose={() => setSelectedFileId(null)}
        />
      )}
    </div>
  );
}

// List View File Item
interface FileItemProps {
  file: UploadedFile;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  thumbnail?: string;
  onSelect: () => void;
  onDelete: () => void;
  onPasswordClick: () => void;
  onRotate?: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function ListFileItem({
  file,
  index,
  isSelected,
  isDragging,
  isDragOver,
  onSelect,
  onDelete,
  onPasswordClick,
  onRotate,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: FileItemProps) {
  const isLocked = file.isPasswordProtected && !file.password;
  const isUnlocked = file.isPasswordProtected && file.password;
  const rotation = file.rotation || 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 sm:gap-3 rounded-lg border p-2 sm:p-3 transition-all ${
        isDragging
          ? "border-blue-400 bg-blue-50 opacity-50"
          : isDragOver
            ? "border-blue-400 bg-blue-50"
            : isSelected
              ? "border-blue-500 bg-blue-50"
              : isLocked
                ? "border-amber-400 bg-amber-50 hover:border-amber-500"
                : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* Selection checkbox - hidden on mobile */}
      <button
        onClick={onSelect}
        className={`hidden sm:flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          isSelected
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-gray-300 hover:border-blue-400"
        }`}
      >
        {isSelected && <CheckCircle2 className="h-3 w-3" />}
      </button>

      {/* Drag handle */}
      <div className="cursor-grab text-gray-400 hover:text-gray-600 shrink-0">
        <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>

      {/* Order number */}
      <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
        {index + 1}
      </div>

      {/* File icon with rotation indicator */}
      <div className="shrink-0 relative">
        {file.type === "pdf" ? (
          <div
            className={`rounded p-1.5 sm:p-2 ${isLocked ? "bg-amber-100" : "bg-red-100"}`}
          >
            <FileText
              className={`h-4 w-4 sm:h-5 sm:w-5 ${isLocked ? "text-amber-600" : "text-red-600"}`}
            />
          </div>
        ) : (
          <div className="rounded bg-blue-100 p-1.5 sm:p-2">
            <Image
              className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 transition-transform duration-300"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </div>
        )}
        {/* Rotation badge */}
        {file.type === "image" && rotation > 0 && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">
            {rotation}°
          </div>
        )}
      </div>

      {/* File info - Takes remaining space */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <h4
          className="truncate text-sm font-medium text-gray-900"
          title={file.name}
        >
          {file.name}
        </h4>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
          <span className="shrink-0">{formatFileSize(file.size)}</span>
          {file.pages && (
            <>
              <span>•</span>
              <span className="shrink-0">{file.pages} pages</span>
            </>
          )}
          {/* Rotation indicator in info */}
          {file.type === "image" && rotation > 0 && (
            <>
              <span>•</span>
              <span className="text-blue-600 font-medium">↻ {rotation}°</span>
            </>
          )}
          {isLocked && (
            <>
              <span>•</span>
              <span className="text-amber-600 font-medium">
                🔒 Tap to unlock
              </span>
            </>
          )}
          {isUnlocked && (
            <>
              <span>•</span>
              <span className="text-green-600 font-medium">✓ Unlocked</span>
            </>
          )}
        </div>
      </div>

      {/* Actions - Compact */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Rotate button - only for images */}
        {onRotate && file.type === "image" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRotate}
            className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600 active:scale-90 transition-all"
            title={`Rotate 90° (currently ${rotation}°)`}
          >
            <RotateCw
              className="h-4 w-4 transition-transform duration-300"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </Button>
        )}
        {file.isPasswordProtected && (
          <Button
            variant={isLocked ? "default" : "ghost"}
            size="icon"
            onClick={onPasswordClick}
            className={`h-8 w-8 ${
              isLocked
                ? "bg-amber-500 hover:bg-amber-600 text-white animate-pulse"
                : "text-green-600 hover:bg-green-50"
            }`}
            title={
              file.password
                ? "Password entered - Click to change"
                : "Enter password to unlock"
            }
          >
            {file.password ? (
              <LockOpen className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-600"
          title="Remove file"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Grid View File Item
function GridFileItem({
  file,
  index,
  isSelected,
  isDragging,
  isDragOver,
  thumbnail,
  onSelect,
  onDelete,
  onPasswordClick,
  onRotate,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: FileItemProps) {
  const isLocked = file.isPasswordProtected && !file.password;
  const rotation = file.rotation || 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative rounded-lg border p-3 transition-all ${
        isDragging
          ? "border-blue-400 bg-blue-50 opacity-50"
          : isDragOver
            ? "border-blue-400 bg-blue-50"
            : isSelected
              ? "border-blue-500 bg-blue-50"
              : isLocked
                ? "border-amber-400 bg-amber-50 hover:border-amber-500"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      {/* Selection checkbox */}
      <button
        onClick={onSelect}
        className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
          isSelected
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-gray-300 bg-white opacity-0 group-hover:opacity-100 hover:border-blue-400"
        }`}
      >
        {isSelected && <CheckCircle2 className="h-3 w-3" />}
      </button>

      {/* Order badge */}
      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800/70 text-[10px] font-medium text-white">
        {index + 1}
      </div>

      {/* Rotate button - only for images */}
      {onRotate && file.type === "image" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRotate();
          }}
          className="absolute left-2 bottom-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white shadow-md transition-all hover:bg-blue-600 hover:scale-110"
          title="Rotate 90°"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute right-2 bottom-2 z-10 flex h-6 w-6 items-center justify-center rounded bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      {/* File preview with thumbnail */}
      <div className="flex flex-col items-center pt-4">
        {thumbnail ? (
          <div className="relative h-20 w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
            <img
              src={thumbnail}
              alt={file.name}
              className={`max-h-full max-w-full object-contain transition-transform duration-300 ${
                rotation === 90 || rotation === 270 ? "scale-75" : ""
              }`}
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            {isLocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-amber-500/80">
                <Lock className="h-6 w-6 text-white" />
              </div>
            )}
            {/* Rotation indicator badge */}
            {file.type === "image" && rotation > 0 && (
              <div className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white shadow">
                {rotation}°
              </div>
            )}
          </div>
        ) : file.type === "pdf" ? (
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-lg ${isLocked ? "bg-amber-100" : "bg-red-100"}`}
          >
            <FileText
              className={`h-8 w-8 ${isLocked ? "text-amber-600" : "text-red-600"}`}
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100">
            <Image className="h-8 w-8 text-blue-600" />
          </div>
        )}

        {/* File name */}
        <p className="mt-2 w-full truncate text-center text-xs font-medium text-gray-900">
          {file.name}
        </p>

        {/* File size */}
        <p className="mt-0.5 text-[10px] text-gray-500">
          {formatFileSize(file.size)}
        </p>

        {/* Password indicator */}
        {file.isPasswordProtected && (
          <button
            onClick={onPasswordClick}
            className={`mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
              file.password
                ? "bg-green-100 text-green-700"
                : "bg-amber-500 text-white animate-pulse"
            }`}
            title={
              file.password
                ? "Password entered - Click to change"
                : "Tap to unlock"
            }
          >
            {file.password ? (
              <LockOpen className="h-2.5 w-2.5" />
            ) : (
              <Lock className="h-2.5 w-2.5" />
            )}
            {file.password ? "Unlocked" : "Tap to unlock"}
          </button>
        )}
      </div>
    </div>
  );
}
