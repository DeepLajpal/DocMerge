"use client";

import { useEffect, useRef } from "react";
import { useMergeStore } from "@/lib/store";
import { detectPasswordProtection, getPDFPageCount } from "@/lib/pdf-utils";
import { FileManager } from "./doc-merge/file-manager";
import { OutputSettings } from "./doc-merge/output-settings";
import { CompressionPanel } from "./doc-merge/compression-panel";
import { MergeButton } from "./doc-merge/merge-button";
import { SuccessSummary } from "./doc-merge/success-summary";
import { FileText } from "lucide-react";

export function DocMergeApp() {
  const files = useMergeStore((state) => state.files);
  const mergeResult = useMergeStore((state) => state.mergeResult);
  const updateFileProtection = useMergeStore(
    (state) => state.updateFileProtection,
  );
  const reorderFiles = useMergeStore((state) => state.reorderFiles);
  const processedFileIds = useRef<Set<string>>(new Set());

  // Check for password protection when files are added
  useEffect(() => {
    const checkPasswordsAndPages = async () => {
      for (const file of files) {
        // Skip if already processed
        if (processedFileIds.current.has(file.id)) continue;

        // Mark as processed immediately to avoid duplicate processing
        processedFileIds.current.add(file.id);

        if (file.type === "pdf") {
          try {
            const isProtected = await detectPasswordProtection(file.file);

            if (isProtected) {
              // Use the dedicated updateFileProtection function
              updateFileProtection(file.id, true);
            } else {
              // Get page count for non-protected PDFs
              const pageCount = await getPDFPageCount(file.file);
              const store = useMergeStore.getState();
              const updatedFiles = store.files.map((f) =>
                f.id === file.id ? { ...f, pages: pageCount } : f,
              );
              reorderFiles(updatedFiles);
            }
          } catch (error) {
            console.error("Error checking PDF:", error);
          }
        }
      }
    };

    if (files.length > 0) {
      checkPasswordsAndPages();
    }
  }, [files, updateFileProtection, reorderFiles]);

  if (mergeResult) {
    return <SuccessSummary />;
  }

  const hasFiles = files.length > 0;

  return (
    <>
      {/* Header — centered hero or compact navbar */}
      {hasFiles ? (
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">DocMerge</h1>
        </div>
      ) : (
        <div className="mb-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-blue-100 p-3">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-3">
            DocMerge
          </h1>
          <p className="text-xl text-gray-600">
            Merge PDFs and images into a single document
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Fast, secure, and completely in-browser processing
          </p>
        </div>
      )}

      {/* App content */}
      {hasFiles ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <FileManager />
          <div className="space-y-4">
            <OutputSettings />
            <CompressionPanel />
            <MergeButton />
          </div>
        </div>
      ) : (
        <FileManager />
      )}
    </>
  );
}
