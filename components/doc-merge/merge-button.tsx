"use client";

import { useState } from "react";
import {
  Download,
  AlertCircle,
  Info,
  Lock,
  FileX,
  AlertTriangle,
} from "lucide-react";
import { useMergeStore } from "@/lib/store";
import { mergePDFsAndImages } from "@/lib/pdf-utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function MergeButton() {
  const files = useMergeStore((state) => state.files);
  const outputSettings = useMergeStore((state) => state.outputSettings);
  const compressionSettings = useMergeStore(
    (state) => state.compressionSettings,
  );
  const isLoading = useMergeStore((state) => state.isLoading);
  const error = useMergeStore((state) => state.error);
  const qualityWarning = useMergeStore((state) => state.qualityWarning);
  const setLoading = useMergeStore((state) => state.setLoading);
  const setMergeResult = useMergeStore((state) => state.setMergeResult);
  const setError = useMergeStore((state) => state.setError);
  const setQualityWarning = useMergeStore((state) => state.setQualityWarning);

  const passwordProtectedFiles = files.filter(
    (f) => f.isPasswordProtected && !f.password,
  );
  const hasPasswordProtectedFiles = passwordProtectedFiles.length > 0;

  const isDisabled =
    files.length === 0 || isLoading || hasPasswordProtectedFiles;

  // Determine why button is disabled
  const getDisabledReason = () => {
    if (files.length === 0) {
      return {
        icon: FileX,
        message: "Upload at least one file to merge",
        color: "text-gray-500 bg-gray-50 border-gray-200",
      };
    }
    if (hasPasswordProtectedFiles) {
      const count = passwordProtectedFiles.length;
      return {
        icon: Lock,
        message: `${count} password-protected PDF${count > 1 ? "s" : ""} need${count === 1 ? "s" : ""} a password`,
        color: "text-amber-600 bg-amber-50 border-amber-200",
      };
    }
    return null;
  };

  const disabledReason = getDisabledReason();

  const handleMerge = async () => {
    if (files.length === 0) {
      setError("Please upload at least one file");
      return;
    }

    if (hasPasswordProtectedFiles) {
      setError("Please provide passwords for all password-protected PDFs");
      return;
    }

    setError(undefined);
    setQualityWarning(undefined);
    setLoading(true);

    try {
      const mergeResult = await mergePDFsAndImages(
        files,
        outputSettings,
        compressionSettings,
      );

      // Calculate page count (rough estimate)
      const pageCount = files.reduce((sum, f) => sum + (f.pages || 1), 0);

      // Check if quality was reduced and notify user
      if (mergeResult.qualityReduced) {
        const fileCount = mergeResult.reducedFiles.length;
        const fileList =
          fileCount <= 3
            ? mergeResult.reducedFiles.join(", ")
            : `${mergeResult.reducedFiles.slice(0, 3).join(", ")} and ${fileCount - 3} more`;

        const warningMessage =
          `Some images were automatically optimized for your device to ensure the PDF renders correctly. ` +
          `This happens when images are too large for your device's graphics memory. ` +
          `Affected files: ${fileList}. The PDF quality may be slightly reduced.`;

        setQualityWarning(warningMessage);
        console.info(
          `[merge-button] Quality reduced for ${fileCount} file(s):`,
          mergeResult.reducedFiles,
        );
      }

      setMergeResult({
        pages: pageCount,
        finalSize: mergeResult.pdfBytes.length,
        qualityReduced: mergeResult.qualityReduced,
      });

      // Download the PDF
      const blob = new Blob([mergeResult.pdfBytes as BlobPart], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${outputSettings.filename}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to merge files. Please try again.");
      console.error("Merge error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Quality warning notification */}
      {qualityWarning && !error && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800">
              Images were automatically optimized
            </p>
            <p className="text-sm text-amber-700">{qualityWarning}</p>
          </div>
        </div>
      )}

      {/* Show why button is disabled */}
      {disabledReason && !isLoading && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 ${disabledReason.color}`}
        >
          <disabledReason.icon className="h-4 w-4 shrink-0" />
          <p className="text-sm">{disabledReason.message}</p>
        </div>
      )}

      <Button
        onClick={handleMerge}
        disabled={isDisabled}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        size="lg"
      >
        {isLoading ? (
          <>
            <Spinner className="mr-2 h-4 w-4" />
            Merging...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Merge & Download PDF
          </>
        )}
      </Button>
    </div>
  );
}
