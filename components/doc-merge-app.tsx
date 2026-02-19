"use client";

import { useEffect, useRef } from "react";
import { useMergeStore } from "@/lib/store";
import { detectPasswordProtection, getPDFPageCount } from "@/lib/pdf-utils";
import { FileManager } from "./doc-merge/file-manager";
import { OutputSettings } from "./doc-merge/output-settings";
import { CompressionPanel } from "./doc-merge/compression-panel";
import { MergeButton } from "./doc-merge/merge-button";
import { SuccessSummary } from "./doc-merge/success-summary";

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      {/* Left Column — Files */}
      <FileManager />

      {/* Right Column — Settings & Merge */}
      {files.length > 0 && (
        <div className="space-y-4">
          <OutputSettings />
          <CompressionPanel />
          <MergeButton />
        </div>
      )}
    </div>
  );
}
