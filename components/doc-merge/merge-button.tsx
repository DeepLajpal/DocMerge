"use client";

import { useState } from "react";
import {
  Download,
  AlertCircle,
  Info,
  Lock,
  FileX,
  AlertTriangle,
  Server,
} from "lucide-react";
import { useMergeStore } from "@/lib/store";
import { mergePDFsAndImages } from "@/lib/pdf-utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type {
  UploadedFile,
  OutputSettings,
  CompressionSettings,
} from "@/lib/types";

/**
 * Merge files on the server using the API endpoint.
 * This bypasses Canvas completely for guaranteed quality.
 */
async function mergeOnServer(
  files: UploadedFile[],
  outputSettings: OutputSettings,
  compressionSettings: CompressionSettings,
): Promise<{ pdfBytes: Uint8Array; pages: number }> {
  // Convert files to base64 for API transport
  const fileInputs = await Promise.all(
    files.map(async (file) => {
      const arrayBuffer = await file.file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          "",
        ),
      );
      return {
        name: file.name,
        type: file.type,
        data: base64,
        rotation: file.rotation || 0,
        password: file.password,
        cropData: file.cropData,
      };
    }),
  );

  const response = await fetch("/api/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: fileInputs,
      settings: {
        pageSize: outputSettings.pageSize,
        orientation: outputSettings.orientation,
        customWidth: outputSettings.customWidth,
        customHeight: outputSettings.customHeight,
      },
      compression: {
        quality: compressionSettings.quality,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const result = await response.json();

  // Decode base64 PDF
  const binaryString = atob(result.pdfBase64);
  const pdfBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pdfBytes[i] = binaryString.charCodeAt(i);
  }

  return { pdfBytes, pages: result.pages };
}

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
      let pdfBytes: Uint8Array;
      let pageCount: number;
      let qualityReduced = false;
      let reducedFiles: string[] = [];
      let usedDirectEmbed = false;
      let directEmbedFiles: string[] = [];

      if (compressionSettings.processingMode === "server") {
        // Server-side processing - guaranteed quality, no Canvas limitations
        console.info("[merge-button] Using server-side processing");
        const result = await mergeOnServer(
          files,
          outputSettings,
          compressionSettings,
        );
        pdfBytes = result.pdfBytes;
        pageCount = result.pages;
        // Server processing has no quality warnings
      } else {
        // Browser-side processing - may have Canvas limitations on mobile
        console.info("[merge-button] Using browser-side processing");
        const mergeResult = await mergePDFsAndImages(
          files,
          outputSettings,
          compressionSettings,
        );
        pdfBytes = mergeResult.pdfBytes as Uint8Array;
        pageCount = files.reduce((sum, f) => sum + (f.pages || 1), 0);
        qualityReduced = mergeResult.qualityReduced || false;
        reducedFiles = mergeResult.reducedFiles;
        usedDirectEmbed = mergeResult.usedDirectEmbed || false;
        directEmbedFiles = mergeResult.directEmbedFiles || [];
      }

      // Check if quality was reduced and notify user (browser mode only)
      if (qualityReduced && reducedFiles.length > 0) {
        const fileCount = reducedFiles.length;
        const fileList =
          fileCount <= 3
            ? reducedFiles.join(", ")
            : `${reducedFiles.slice(0, 3).join(", ")} and ${fileCount - 3} more`;

        let warningMessage: string;

        if (usedDirectEmbed) {
          // Direct embed was used - explain that original images were used
          warningMessage =
            `Your device couldn't process some images, so we used the original files directly. ` +
            `The PDF was created successfully but may be larger than expected. ` +
            `Affected files: ${fileList}.`;

          console.info(
            `[merge-button] Direct embed used for ${directEmbedFiles.length} file(s):`,
            directEmbedFiles,
          );
        } else {
          // Quality reduced but no direct embed
          warningMessage =
            `Some images were automatically optimized for your device to ensure the PDF renders correctly. ` +
            `This happens when images are too large for your device's graphics memory. ` +
            `Affected files: ${fileList}. The PDF quality may be slightly reduced.`;
        }

        setQualityWarning(warningMessage);
        console.info(
          `[merge-button] Quality reduced for ${fileCount} file(s):`,
          reducedFiles,
        );
      }

      // Create blob URL for download
      const blob = new Blob([pdfBytes as BlobPart], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const filename = `${outputSettings.filename}.pdf`;

      setMergeResult({
        pages: pageCount,
        finalSize: pdfBytes.length,
        qualityReduced: qualityReduced,
        downloadUrl: url,
        downloadFilename: filename,
      });

      // Auto-download the PDF
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Note: URL is NOT revoked here so user can re-download from success page
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
