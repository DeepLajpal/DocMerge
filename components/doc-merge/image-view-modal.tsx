"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UploadedFile } from "@/lib/types";

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

interface ImageViewModalProps {
  file: UploadedFile;
  onClose: () => void;
}

export function ImageViewModal({ file, onClose }: ImageViewModalProps) {
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [fileSrc, setFileSrc] = useState<string | null>(null);

  // PDF-specific state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const isPdf = file.type === "pdf";

  // Render a specific PDF page to canvas
  const renderPdfPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDocRef.current || !canvasRef.current) return;

      try {
        setPdfLoading(true);
        const page = await pdfDocRef.current.getPage(pageNum);

        // Calculate viewport with scale and rotation
        const baseScale = 1.5; // Higher quality than thumbnails
        const viewport = page.getViewport({
          scale: baseScale * scale,
          rotation: rotation,
        });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        setPdfLoading(false);
      } catch (error) {
        console.error("Failed to render PDF page:", error);
        setPdfError("Failed to render page");
        setPdfLoading(false);
      }
    },
    [scale, rotation],
  );

  // Load PDF document
  useEffect(() => {
    if (!isPdf || !file.file) return;

    let cancelled = false;

    const loadPdf = async () => {
      try {
        setPdfLoading(true);
        setPdfError(null);

        const arrayBuffer = await file.file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          password: file.password || undefined,
        });

        const pdf = await loadingTask.promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setCurrentPage(1);

        // Render first page
        await renderPdfPage(1);
      } catch (error: any) {
        if (!cancelled) {
          console.error("Failed to load PDF:", error);
          if (error?.name === "PasswordException") {
            setPdfError("Password required to view this PDF");
          } else {
            setPdfError("Failed to load PDF");
          }
          setPdfLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [file, isPdf]);

  // Re-render when page, scale, or rotation changes
  useEffect(() => {
    if (isPdf && pdfDocRef.current && currentPage > 0) {
      renderPdfPage(currentPage);
    }
  }, [currentPage, scale, rotation, isPdf, renderPdfPage]);

  // Load image source (for non-PDF files)
  useEffect(() => {
    if (isPdf || !file.file) return;

    const url = URL.createObjectURL(file.file);
    setFileSrc(url);

    // Initialize with existing rotation if any
    if (file.rotation) {
      setRotation(file.rotation);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, isPdf]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center justify-between text-base">
            <span className="truncate max-w-[calc(100%-200px)]">
              {file.name}
            </span>
            <div className="flex items-center gap-1">
              {/* Page navigation for PDFs */}
              {isPdf && totalPages > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevPage}
                    disabled={currentPage <= 1 || pdfLoading}
                    title="Previous Page"
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-gray-500 w-16 text-center">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages || pdfLoading}
                    title="Next Page"
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                </>
              )}
              {/* Zoom controls */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={scale <= 0.5 || (isPdf && pdfLoading)}
                title="Zoom Out"
                className="h-8 w-8"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-500 w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={scale >= 3 || (isPdf && pdfLoading)}
                title="Zoom In"
                className="h-8 w-8"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRotate}
                disabled={isPdf && pdfLoading}
                title="Rotate 90°"
                className="h-8 w-8"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gray-100 p-4 flex items-center justify-center min-h-0">
          {isPdf ? (
            // PDF canvas-based viewer
            pdfError ? (
              <div className="flex h-full flex-col items-center justify-center text-gray-500 gap-2">
                <p>{pdfError}</p>
              </div>
            ) : (
              <div className="relative">
                {pdfLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-[calc(90vh-100px)] object-contain shadow-md rounded-sm bg-white"
                />
              </div>
            )
          ) : fileSrc ? (
            // Image viewer
            <div
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                transition: "transform 0.2s ease-in-out",
              }}
              className="origin-center"
            >
              <img
                src={fileSrc}
                alt={file.name}
                className="max-w-full max-h-[calc(90vh-100px)] object-contain shadow-md rounded-sm"
              />
            </div>
          ) : (
            <div className="text-gray-400">Loading...</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
