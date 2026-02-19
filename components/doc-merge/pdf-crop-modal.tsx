"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Crop,
  RotateCcw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Move,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UploadedFile, CropData, PageCropData } from "@/lib/types";

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

interface PdfCropModalProps {
  file: UploadedFile;
  onApplyPage: (pageNumber: number, cropData: CropData) => void;
  onResetPage: (pageNumber: number) => void;
  onResetAll: () => void;
  onClose: () => void;
}

type DragMode =
  | "none"
  | "move"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "e"
  | "w";

export function PdfCropModal({
  file,
  onApplyPage,
  onResetPage,
  onResetAll,
  onClose,
}: PdfCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Rendered page as image data URL
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);

  // Image display dimensions
  const [imageRect, setImageRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Crop rectangle in percentage (0-1) relative to image
  const [cropRect, setCropRect] = useState<CropData | null>(null);

  // Drag state
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartRect, setDragStartRect] = useState<CropData | null>(null);

  // Track crops per page during this session
  const [sessionCrops, setSessionCrops] = useState<PageCropData>(
    file.pageCropData || {},
  );

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setPageLoading(true);
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

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
      } catch (error: any) {
        if (!cancelled) {
          console.error("Failed to load PDF:", error);
          if (error?.name === "PasswordException") {
            setPdfError("Password required to view this PDF");
          } else {
            setPdfError("Failed to load PDF");
          }
          setPageLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Cleanup PDF document on unmount
  useEffect(() => {
    return () => {
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [pdfDoc]);

  // Render page to image URL (only when page changes)
  useEffect(() => {
    if (!pdfDoc) return;

    let cancelled = false;

    const renderPageToImage = async () => {
      try {
        setPageLoading(true);

        const page = await pdfDoc.getPage(currentPage);

        // Render at 1.5x scale for good quality
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          if (!cancelled) {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
            setPageImageUrl(dataUrl);
            setPageLoading(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to render page:", error);
          setPdfError("Failed to render page");
          setPageLoading(false);
        }
      }
    };

    renderPageToImage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage]);

  // Update image rect when image loads or container resizes
  const updateImageRect = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    setImageRect({
      x: imgRect.left - containerRect.left,
      y: imgRect.top - containerRect.top,
      w: imgRect.width,
      h: imgRect.height,
    });
  }, []);

  // Initialize crop from existing data or set default when image loads
  useEffect(() => {
    if (imageRect.w > 0 && !pageLoading) {
      const existingCrop = sessionCrops[currentPage];
      if (existingCrop) {
        setCropRect(existingCrop);
      } else {
        // Set default crop to 80% centered
        setCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
      }
    }
  }, [currentPage, imageRect.w, pageLoading, sessionCrops]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      updateImageRect();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateImageRect]);

  // Convert percentage crop to pixel coordinates
  const getCropPixels = () => {
    if (!cropRect || imageRect.w === 0) return null;
    return {
      left: imageRect.x + cropRect.x * imageRect.w,
      top: imageRect.y + cropRect.y * imageRect.h,
      width: cropRect.width * imageRect.w,
      height: cropRect.height * imageRect.h,
    };
  };

  // Get event coordinates relative to container
  const getEventCoords = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
  ) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const clientY = "touches" in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Handle drag start on handles or crop area
  const handleDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    mode: DragMode,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const coords = getEventCoords(e);
    setDragMode(mode);
    setDragStart(coords);
    setDragStartRect(cropRect);
  };

  // Handle drag move
  useEffect(() => {
    if (dragMode === "none") return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const coords = getEventCoords(e);
      if (!dragStartRect) return;

      const deltaXPercent = (coords.x - dragStart.x) / imageRect.w;
      const deltaYPercent = (coords.y - dragStart.y) / imageRect.h;

      let newRect = { ...dragStartRect };

      if (dragMode === "move") {
        // Move the entire rectangle
        let newX = dragStartRect.x + deltaXPercent;
        let newY = dragStartRect.y + deltaYPercent;

        // Clamp to bounds
        newX = Math.max(0, Math.min(1 - dragStartRect.width, newX));
        newY = Math.max(0, Math.min(1 - dragStartRect.height, newY));

        newRect = { ...dragStartRect, x: newX, y: newY };
      } else {
        // Resize based on handle
        const minSize = 0.05; // Minimum 5% of image

        switch (dragMode) {
          case "nw": {
            const newX = Math.max(
              0,
              Math.min(
                dragStartRect.x + dragStartRect.width - minSize,
                dragStartRect.x + deltaXPercent,
              ),
            );
            const newY = Math.max(
              0,
              Math.min(
                dragStartRect.y + dragStartRect.height - minSize,
                dragStartRect.y + deltaYPercent,
              ),
            );
            newRect = {
              x: newX,
              y: newY,
              width: dragStartRect.x + dragStartRect.width - newX,
              height: dragStartRect.y + dragStartRect.height - newY,
            };
            break;
          }
          case "ne": {
            const newY = Math.max(
              0,
              Math.min(
                dragStartRect.y + dragStartRect.height - minSize,
                dragStartRect.y + deltaYPercent,
              ),
            );
            const newWidth = Math.max(
              minSize,
              Math.min(
                1 - dragStartRect.x,
                dragStartRect.width + deltaXPercent,
              ),
            );
            newRect = {
              x: dragStartRect.x,
              y: newY,
              width: newWidth,
              height: dragStartRect.y + dragStartRect.height - newY,
            };
            break;
          }
          case "sw": {
            const newX = Math.max(
              0,
              Math.min(
                dragStartRect.x + dragStartRect.width - minSize,
                dragStartRect.x + deltaXPercent,
              ),
            );
            const newHeight = Math.max(
              minSize,
              Math.min(
                1 - dragStartRect.y,
                dragStartRect.height + deltaYPercent,
              ),
            );
            newRect = {
              x: newX,
              y: dragStartRect.y,
              width: dragStartRect.x + dragStartRect.width - newX,
              height: newHeight,
            };
            break;
          }
          case "se": {
            const newWidth = Math.max(
              minSize,
              Math.min(
                1 - dragStartRect.x,
                dragStartRect.width + deltaXPercent,
              ),
            );
            const newHeight = Math.max(
              minSize,
              Math.min(
                1 - dragStartRect.y,
                dragStartRect.height + deltaYPercent,
              ),
            );
            newRect = {
              ...dragStartRect,
              width: newWidth,
              height: newHeight,
            };
            break;
          }
          case "n": {
            const newY = Math.max(
              0,
              Math.min(
                dragStartRect.y + dragStartRect.height - minSize,
                dragStartRect.y + deltaYPercent,
              ),
            );
            newRect = {
              ...dragStartRect,
              y: newY,
              height: dragStartRect.y + dragStartRect.height - newY,
            };
            break;
          }
          case "s": {
            const newHeight = Math.max(
              minSize,
              Math.min(
                1 - dragStartRect.y,
                dragStartRect.height + deltaYPercent,
              ),
            );
            newRect = { ...dragStartRect, height: newHeight };
            break;
          }
          case "w": {
            const newX = Math.max(
              0,
              Math.min(
                dragStartRect.x + dragStartRect.width - minSize,
                dragStartRect.x + deltaXPercent,
              ),
            );
            newRect = {
              ...dragStartRect,
              x: newX,
              width: dragStartRect.x + dragStartRect.width - newX,
            };
            break;
          }
          case "e": {
            const newWidth = Math.max(
              minSize,
              Math.min(
                1 - dragStartRect.x,
                dragStartRect.width + deltaXPercent,
              ),
            );
            newRect = { ...dragStartRect, width: newWidth };
            break;
          }
        }
      }

      setCropRect(newRect);
    };

    const handleEnd = () => {
      setDragMode("none");
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [dragMode, dragStart, dragStartRect, imageRect]);

  const handleApplyCurrentPage = () => {
    if (cropRect) {
      setSessionCrops((prev) => ({ ...prev, [currentPage]: cropRect }));
      onApplyPage(currentPage, cropRect);
    }
  };

  const handleResetCurrentPage = () => {
    setCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    setSessionCrops((prev) => {
      const { [currentPage]: removed, ...rest } = prev;
      return rest;
    });
    onResetPage(currentPage);
  };

  const handleResetAllPages = () => {
    setCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    setSessionCrops({});
    onResetAll();
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const cropPixels = getCropPixels();
  const hasCrop = cropRect !== null;
  const hasAnyCrops = Object.keys(sessionCrops).length > 0;
  const currentPageHasCrop = sessionCrops[currentPage] !== undefined;
  const croppedPagesCount = Object.keys(sessionCrops).length;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crop className="h-4 w-4 text-blue-600" />
            <span className="truncate">Crop PDF — {file.name}</span>
            {croppedPagesCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                {croppedPagesCount} page{croppedPagesCount > 1 ? "s" : ""}{" "}
                cropped
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Page navigation */}
        {totalPages > 1 && (
          <div className="px-5 pb-2 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || pageLoading}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-20 text-center">
              Page {currentPage} of {totalPages}
              {currentPageHasCrop && (
                <Crop className="inline h-3 w-3 ml-1 text-blue-600" />
              )}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages || pageLoading}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Crop area */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[200px] mx-5 my-2 p-4 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center overflow-visible"
        >
          {/* PDF page image */}
          {pageImageUrl && (
            <img
              ref={imageRef}
              src={pageImageUrl}
              alt={`Page ${currentPage}`}
              className="max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] object-contain shadow-lg"
              onLoad={updateImageRect}
              draggable={false}
            />
          )}

          {/* Darkening overlay outside crop area */}
          {cropPixels && imageRect.w > 0 && (
            <>
              {/* Top dark area */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: imageRect.x,
                  top: imageRect.y,
                  width: imageRect.w,
                  height: cropPixels.top - imageRect.y,
                }}
              />
              {/* Bottom dark area */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: imageRect.x,
                  top: cropPixels.top + cropPixels.height,
                  width: imageRect.w,
                  height:
                    imageRect.y +
                    imageRect.h -
                    (cropPixels.top + cropPixels.height),
                }}
              />
              {/* Left dark area */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: imageRect.x,
                  top: cropPixels.top,
                  width: cropPixels.left - imageRect.x,
                  height: cropPixels.height,
                }}
              />
              {/* Right dark area */}
              <div
                className="absolute bg-black/50 pointer-events-none"
                style={{
                  left: cropPixels.left + cropPixels.width,
                  top: cropPixels.top,
                  width:
                    imageRect.x +
                    imageRect.w -
                    (cropPixels.left + cropPixels.width),
                  height: cropPixels.height,
                }}
              />
            </>
          )}

          {/* Crop rectangle with handles */}
          {cropPixels && (
            <div
              className="absolute border-2 border-blue-500 border-dashed"
              style={{
                left: cropPixels.left,
                top: cropPixels.top,
                width: cropPixels.width,
                height: cropPixels.height,
              }}
            >
              {/* Move handle (center) */}
              <div
                className="absolute inset-0 cursor-move flex items-center justify-center"
                onMouseDown={(e) => handleDragStart(e, "move")}
                onTouchStart={(e) => handleDragStart(e, "move")}
              >
                <div className="bg-blue-500/20 rounded-full p-2">
                  <Move className="h-5 w-5 text-blue-600" />
                </div>
              </div>

              {/* Corner handles */}
              {/* NW */}
              <div
                className="absolute -left-2 -top-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-nw-resize shadow"
                onMouseDown={(e) => handleDragStart(e, "nw")}
                onTouchStart={(e) => handleDragStart(e, "nw")}
              />
              {/* NE */}
              <div
                className="absolute -right-2 -top-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-ne-resize shadow"
                onMouseDown={(e) => handleDragStart(e, "ne")}
                onTouchStart={(e) => handleDragStart(e, "ne")}
              />
              {/* SW */}
              <div
                className="absolute -left-2 -bottom-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-sw-resize shadow"
                onMouseDown={(e) => handleDragStart(e, "sw")}
                onTouchStart={(e) => handleDragStart(e, "sw")}
              />
              {/* SE */}
              <div
                className="absolute -right-2 -bottom-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-se-resize shadow"
                onMouseDown={(e) => handleDragStart(e, "se")}
                onTouchStart={(e) => handleDragStart(e, "se")}
              />

              {/* Edge handles */}
              {/* N */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-8 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-n-resize shadow"
                onMouseDown={(e) => handleDragStart(e, "n")}
                onTouchStart={(e) => handleDragStart(e, "n")}
              />
              {/* S */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-8 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-s-resize shadow"
                onMouseDown={(e) => handleDragStart(e, "s")}
                onTouchStart={(e) => handleDragStart(e, "s")}
              />
              {/* W */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-8 bg-blue-500 border-2 border-white rounded-sm cursor-w-resize shadow"
                onMouseDown={(e) => handleDragStart(e, "w")}
                onTouchStart={(e) => handleDragStart(e, "w")}
              />
              {/* E */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-8 bg-blue-500 border-2 border-white rounded-sm cursor-e-resize shadow"
                onMouseDown={(e) => handleDragStart(e, "e")}
                onTouchStart={(e) => handleDragStart(e, "e")}
              />

              {/* Rule of thirds grid */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
              </div>
            </div>
          )}

          {pageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
              <div className="text-gray-500">Loading page...</div>
            </div>
          )}
          {pdfError && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500">
              {pdfError}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="px-5 py-2 text-xs text-gray-500 text-center">
          Drag corners or edges to resize • Drag center to move • Apply to save
        </div>

        {/* Crop info + actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {hasCrop ? (
              <span className="font-medium text-gray-700">
                Crop: {Math.round((cropRect?.width || 0) * 100)}% ×{" "}
                {Math.round((cropRect?.height || 0) * 100)}%
                <span className="text-gray-400 ml-2">
                  at ({Math.round((cropRect?.x || 0) * 100)}%,{" "}
                  {Math.round((cropRect?.y || 0) * 100)}%)
                </span>
              </span>
            ) : (
              <span>Adjust the crop rectangle on the page</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetCurrentPage}
              disabled={!currentPageHasCrop}
              className="text-gray-600"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset Page
            </Button>
            {hasAnyCrops && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetAllPages}
                className="text-red-600 hover:bg-red-50"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset All
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleApplyCurrentPage}
              disabled={!hasCrop}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Apply to Page {currentPage}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
