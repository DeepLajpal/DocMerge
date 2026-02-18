"use client";

import { FileText, Image, Trash2, Lock, Unlock, GripVertical, AlertCircle } from "lucide-react";
import { UploadedFile } from "@/lib/types";
import { formatFileSize } from "@/lib/file-utils";
import { useMergeStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface FileItemProps {
  file: UploadedFile;
  onPasswordClick?: () => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export function FileItem({
  file,
  onPasswordClick,
  isDragging,
  dragHandleProps,
}: FileItemProps) {
  const removeFile = useMergeStore((state) => state.removeFile);

  const handleRemove = () => {
    removeFile(file.id);
  };

  const isLocked = file.isPasswordProtected && !file.password;
  const isUnlocked = file.isPasswordProtected && file.password;

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border p-4 transition-all ${
        isDragging 
          ? "bg-gray-50 shadow-md border-gray-200" 
          : isLocked
            ? "bg-amber-50 border-amber-300 hover:border-amber-400"
            : "bg-white border-gray-200 hover:shadow-sm"
      }`}
    >
      <div
        {...dragHandleProps}
        className="cursor-grab text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="shrink-0">
        {file.type === "pdf" ? (
          <div className={`rounded p-2 ${isLocked ? "bg-amber-100" : "bg-red-100"}`}>
            <FileText className={`h-5 w-5 ${isLocked ? "text-amber-600" : "text-red-600"}`} />
          </div>
        ) : (
          <div className="rounded bg-blue-100 p-2">
            <Image className="h-5 w-5 text-blue-600" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="truncate text-sm font-medium text-gray-900">
          {file.name}
        </h4>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <span>{formatFileSize(file.size)}</span>
          {file.pages && (
            <>
              <span>•</span>
              <span>{file.pages} pages</span>
            </>
          )}
          {isLocked && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <AlertCircle className="h-3 w-3" />
                Locked - tap to unlock
              </span>
            </>
          )}
          {isUnlocked && (
            <>
              <span>•</span>
              <span className="text-green-600 font-medium">Unlocked</span>
            </>
          )}
        </div>
      </div>

      {file.isPasswordProtected && (
        <Button
          variant={isLocked ? "default" : "ghost"}
          size="sm"
          onClick={onPasswordClick}
          className={
            isLocked
              ? "gap-2 bg-amber-500 hover:bg-amber-600 text-white animate-pulse"
              : "gap-2 text-green-600 hover:bg-green-50 hover:text-green-700"
          }
        >
          {isLocked ? (
            <>
              <Lock className="h-4 w-4" />
              <span className="text-xs font-medium">Unlock</span>
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4" />
              <span className="text-xs">Change</span>
            </>
          )}
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRemove}
        className="text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
