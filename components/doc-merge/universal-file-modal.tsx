"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Crop,
  Trash2,
  Check,
  RotateCcw,
  Move,
  Undo2,
  LayoutGrid,
  FileText,
  GripVertical,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UploadedFile, CropData } from "@/lib/types";

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
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

interface UniversalFileModalProps {
  file: UploadedFile;
  onClose: () => void;
  onUpdateRotation: (rotation: number) => void;
  onUpdateCrop: (cropData: CropData | undefined) => void;
  onUpdatePdfPageCrop: (
    pageNumber: number,
    cropData: CropData | undefined,
  ) => void;
  onClearPdfPageCrops: () => void;
  onDeletePdfPage: (pageNumber: number) => void;
  onRestorePdfPage: (pageNumber: number) => void;
  onClearDeletedPages: () => void;
  onUpdatePdfPageRotation: (pageNumber: number, rotation: number) => void;
  onClearPdfPageRotations: () => void;
  onReorderPages: (pageOrder: number[]) => void;
  onClearPageOrder: () => void;
}

export function UniversalFileModal({
  file,
  onClose,
  onUpdateRotation,
  onUpdateCrop,
  onUpdatePdfPageCrop,
  onClearPdfPageCrops,
  onDeletePdfPage,
  onRestorePdfPage,
  onClearDeletedPages,
  onUpdatePdfPageRotation,
  onClearPdfPageRotations,
  onReorderPages,
  onClearPageOrder,
}: UniversalFileModalProps) {
  // View state
  const [scale, setScale] = useState(1);
  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"single" | "grid">("single");

  // Thumbnails for grid view
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [dragOverPage, setDragOverPage] = useState<number | null>(null);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [orderValue, setOrderValue] = useState<string>("");
  const orderInputRef = useRef<HTMLInputElement>(null);

  // PDF-specific state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCropping, setIsCropping] = useState(false);

  // Crop state
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageRect, setImageRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [cropRect, setCropRect] = useState<CropData | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartRect, setDragStartRect] = useState<CropData | null>(null);

  // Local rotation state (for preview)
  const [localRotation, setLocalRotation] = useState(file.rotation || 0);
  const [localPageRotation, setLocalPageRotation] = useState(0);

  // Page image for cropping
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);

  const isPdf = file.type === "pdf";

  // Get current page rotation
  const getCurrentPageRotation = useCallback(() => {
    if (!isPdf) return localRotation;
    return file.pageRotations?.[currentPage] ?? 0;
  }, [isPdf, localRotation, file.pageRotations, currentPage]);

  // Check if current page is deleted
  const isCurrentPageDeleted = useCallback(() => {
    return file.deletedPages?.includes(currentPage) ?? false;
  }, [file.deletedPages, currentPage]);

  // Count remaining pages (not deleted)
  const getRemainingPagesCount = useCallback(() => {
    if (!isPdf) return 1;
    const deletedCount = file.deletedPages?.length ?? 0;
    return totalPages - deletedCount;
  }, [isPdf, totalPages, file.deletedPages]);

  // Render a specific PDF page to canvas (for viewing without crop mode)
  const renderPdfPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDocRef.current || !canvasRef.current) return;

      try {
        setPdfLoading(true);
        const page = await pdfDocRef.current.getPage(pageNum);

        const pageRotation = file.pageRotations?.[pageNum] ?? 0;
        const baseScale = 1.5;
        const viewport = page.getViewport({
          scale: baseScale * scale,
          rotation: pageRotation,
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
    [scale, file.pageRotations],
  );

  // Render page to image URL for cropping
  const renderPageToImage = useCallback(async () => {
    if (!pdfDocRef.current) return;

    try {
      const page = await pdfDocRef.current.getPage(currentPage);
      const pageRotation = file.pageRotations?.[currentPage] ?? 0;
      const viewport = page.getViewport({ scale: 1.5, rotation: pageRotation });

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

        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setPageImageUrl(dataUrl);
      }
    } catch (error) {
      console.error("Failed to render page to image:", error);
    }
  }, [currentPage, file.pageRotations]);

  // Track when PDF document is ready
  const [pdfReady, setPdfReady] = useState(false);


  // Load PDF document
  useEffect(() => {
    if (!isPdf || !file.file) return;

    let cancelled = false;
    setPdfReady(false);

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
        setPdfReady(true); // Signal that PDF is loaded and ready to render
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
    // Using file.id as stable dependency - only reload PDF when the actual file changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, isPdf]);

  // Generate thumbnails when grid view is active
  useEffect(() => {
    if (!isPdf || !pdfReady || !pdfDocRef.current || viewMode !== "grid") return;

    let cancelled = false;

    const generate = async () => {
      const pdf = pdfDocRef.current!;
      const hasCustom = file.pageOrder && file.pageOrder.length > 0;
      const pageNumbers = hasCustom
        ? file.pageOrder!.filter((p) => !file.deletedPages?.includes(p))
        : Array.from({ length: pdf.numPages }, (_, i) => i + 1).filter(
            (p) => !file.deletedPages?.includes(p),
          );

      const result: Record<number, string> = {};
      for (const p of pageNumbers) {
        if (cancelled) break;
        try {
          const page = await pdf.getPage(p);
          const rotation = file.pageRotations?.[p] ?? 0;
          const viewport = page.getViewport({ scale: 0.25, rotation });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          result[p] = canvas.toDataURL("image/jpeg", 0.7);
        } catch (err) {
          console.error("Thumbnail render failed for page", p, err);
        }
      }

      if (!cancelled) setThumbnails(result);
    };

    generate();

    return () => {
      cancelled = true;
    };
  }, [isPdf, pdfReady, file.pageOrder, file.deletedPages, file.pageRotations, viewMode]);

  // Re-render PDF page when page/scale/rotation changes OR when PDF becomes ready (view mode)
  useEffect(() => {
    if (
      isPdf &&
      pdfReady &&
      pdfDocRef.current &&
      currentPage > 0 &&
      !isCropping &&
      viewMode === "single"
    ) {
      renderPdfPage(currentPage);
    }
  }, [
    currentPage,
    scale,
    isPdf,
    renderPdfPage,
    isCropping,
    file.pageRotations,
    pdfReady,
    viewMode,
  ]);

  // Render page to image when entering crop mode for PDF
  useEffect(() => {
    if (isPdf && isCropping && pdfDocRef.current) {
      renderPageToImage();
    }
  }, [isPdf, isCropping, renderPageToImage]);

  // Load image source (for non-PDF files)
  useEffect(() => {
    if (isPdf || !file.file) return;

    const url = URL.createObjectURL(file.file);
    setFileSrc(url);
    setLocalRotation(file.rotation || 0);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, isPdf]);

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

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      updateImageRect();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateImageRect]);

  // Initialize crop rect when entering crop mode
  useEffect(() => {
    if (isCropping && imageRect.w > 0) {
      if (isPdf) {
        const existingCrop = file.pageCropData?.[currentPage];
        setCropRect(
          existingCrop || { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        );
      } else {
        const existingCrop = file.cropData;
        setCropRect(
          existingCrop || { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        );
      }
    }
  }, [
    isCropping,
    imageRect.w,
    isPdf,
    file.pageCropData,
    file.cropData,
    currentPage,
  ]);

  // Handlers
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  const handleRotate = () => {
    if (isPdf) {
      const currentRot = file.pageRotations?.[currentPage] ?? 0;
      const newRotation = (currentRot + 90) % 360;
      onUpdatePdfPageRotation(currentPage, newRotation);
    } else {
      const newRotation = (localRotation + 90) % 360;
      setLocalRotation(newRotation);
      onUpdateRotation(newRotation);
    }
  };

  const handleToggleEditMode = () => {
    if (isEditMode && isCropping) {
      setIsCropping(false);
      setCropRect(null);
    }
    setIsEditMode(!isEditMode);
  };

  const handleStartCrop = () => {
    setIsCropping(true);
    if (isPdf && pdfDocRef.current) {
      renderPageToImage();
    }
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setCropRect(null);
  };

  const handleApplyCrop = () => {
    if (!cropRect) return;
    if (isPdf) {
      onUpdatePdfPageCrop(currentPage, cropRect);
    } else {
      onUpdateCrop(cropRect);
    }
    setIsCropping(false);
    setCropRect(null);
  };

  const handleResetCrop = () => {
    if (isPdf) {
      onUpdatePdfPageCrop(currentPage, undefined);
      setCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    } else {
      onUpdateCrop(undefined);
      setCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    }
  };

  const handleDeletePage = () => {
    if (isPdf && getRemainingPagesCount() > 1) {
      onDeletePdfPage(currentPage);
    }
  };

  const handleRestorePage = () => {
    if (isPdf) {
      onRestorePdfPage(currentPage);
    }
  };

  const handleResetAllEdits = () => {
    if (isPdf) {
      onClearPdfPageCrops();
      onClearDeletedPages();
      onClearPdfPageRotations();
      onClearPageOrder();
    } else {
      onUpdateRotation(0);
      onUpdateCrop(undefined);
      setLocalRotation(0);
    }
  };

  // Crop dragging logic
  const getCropPixels = () => {
    if (!cropRect || imageRect.w === 0) return null;
    return {
      left: imageRect.x + cropRect.x * imageRect.w,
      top: imageRect.y + cropRect.y * imageRect.h,
      width: cropRect.width * imageRect.w,
      height: cropRect.height * imageRect.h,
    };
  };

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
      const minSize = 0.05;

      if (dragMode === "move") {
        let newX = dragStartRect.x + deltaXPercent;
        let newY = dragStartRect.y + deltaYPercent;
        newX = Math.max(0, Math.min(1 - dragStartRect.width, newX));
        newY = Math.max(0, Math.min(1 - dragStartRect.height, newY));
        newRect = { ...dragStartRect, x: newX, y: newY };
      } else {
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
            newRect = { ...dragStartRect, width: newWidth, height: newHeight };
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

    const handleEnd = () => setDragMode("none");

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

  const cropPixels = getCropPixels();
  const hasCurrentPageCrop = isPdf
    ? !!file.pageCropData?.[currentPage]
    : !!file.cropData;
  const hasAnyEdits = isPdf
    ? !!(file.pageCropData && Object.keys(file.pageCropData).length > 0) ||
      !!(file.deletedPages && file.deletedPages.length > 0) ||
      !!(file.pageRotations && Object.keys(file.pageRotations).length > 0) ||
      !!(file.pageOrder && file.pageOrder.length > 0)
    : !!(file.rotation && file.rotation !== 0) || !!file.cropData;

  // Count edit stats for PDF
  const croppedPagesCount = file.pageCropData
    ? Object.keys(file.pageCropData).length
    : 0;
  const deletedPagesCount = file.deletedPages?.length ?? 0;
  const rotatedPagesCount = file.pageRotations
    ? Object.keys(file.pageRotations).length
    : 0;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent
        className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-base">
            <span className="truncate">
              {file.name}
              {isPdf &&
                (croppedPagesCount > 0 ||
                  deletedPagesCount > 0 ||
                  rotatedPagesCount > 0) && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    (
                    {[
                      croppedPagesCount > 0 && `${croppedPagesCount} cropped`,
                      deletedPagesCount > 0 && `${deletedPagesCount} deleted`,
                      rotatedPagesCount > 0 && `${rotatedPagesCount} rotated`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    )
                  </span>
                )}
            </span>
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1">
              {/* Page navigation for PDFs */}
              {isPdf && totalPages > 1 && !isCropping && (
                <>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode(viewMode === "single" ? "grid" : "single")}
                    title={viewMode === "single" ? "Grid View" : "Single Page View"}
                    className={`h-8 w-8 mr-1 ${viewMode === "grid" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                  >
                    {viewMode === "single" ? (
                      <LayoutGrid className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </Button>
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
                  <span
                    className={`text-xs w-16 text-center ${isCurrentPageDeleted() ? "text-red-500 line-through" : "text-gray-500"}`}
                  >
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
              {/* Zoom controls (hide during crop mode) */}
              {!isCropping && (
                <>
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
                </>
              )}
              {/* Edit toggle */}
              <Button
                variant={isEditMode ? "default" : "ghost"}
                size="icon"
                onClick={handleToggleEditMode}
                title={isEditMode ? "Exit Edit Mode" : "Edit"}
                className={`h-8 w-8 ${isEditMode ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
              >
                {isEditMode ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Main content area */}
        <div
          ref={containerRef}
          className={`relative flex-1 overflow-auto bg-gray-100 p-4 flex min-h-0 ${isPdf && viewMode === "grid" ? "items-start justify-start" : "items-center justify-center"}`}
        >
          {/* Deleted page overlay */}
          {isPdf && isCurrentPageDeleted() && !isCropping && (
            <div className="absolute inset-4 z-20 flex items-center justify-center bg-red-50/80 rounded-lg border-2 border-red-200 border-dashed">
              <div className="text-center">
                <Trash2 className="h-12 w-12 text-red-400 mx-auto mb-2" />
                <p className="text-red-600 font-medium">
                  Page {currentPage} is marked for deletion
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRestorePage}
                  className="mt-3 text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Undo2 className="h-4 w-4 mr-1.5" />
                  Restore Page
                </Button>
              </div>
            </div>
          )}

          {/* Cropping UI */}
          {isCropping ? (
            <>
              {/* Image for cropping */}
              {(isPdf ? pageImageUrl : fileSrc) && (
                <img
                  ref={imageRef}
                  src={isPdf ? pageImageUrl! : fileSrc!}
                  alt={isPdf ? `Page ${currentPage}` : file.name}
                  className="max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] object-contain shadow-lg"
                  style={
                    !isPdf
                      ? { transform: `rotate(${localRotation}deg)` }
                      : undefined
                  }
                  onLoad={updateImageRect}
                  draggable={false}
                />
              )}

              {/* Darkening overlay outside crop area */}
              {cropPixels && imageRect.w > 0 && (
                <>
                  <div
                    className="absolute bg-black/50 pointer-events-none"
                    style={{
                      left: imageRect.x,
                      top: imageRect.y,
                      width: imageRect.w,
                      height: cropPixels.top - imageRect.y,
                    }}
                  />
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
                  <div
                    className="absolute bg-black/50 pointer-events-none"
                    style={{
                      left: imageRect.x,
                      top: cropPixels.top,
                      width: cropPixels.left - imageRect.x,
                      height: cropPixels.height,
                    }}
                  />
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
                  <div
                    className="absolute -left-2 -top-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-nw-resize shadow"
                    onMouseDown={(e) => handleDragStart(e, "nw")}
                    onTouchStart={(e) => handleDragStart(e, "nw")}
                  />
                  <div
                    className="absolute -right-2 -top-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-ne-resize shadow"
                    onMouseDown={(e) => handleDragStart(e, "ne")}
                    onTouchStart={(e) => handleDragStart(e, "ne")}
                  />
                  <div
                    className="absolute -left-2 -bottom-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-sw-resize shadow"
                    onMouseDown={(e) => handleDragStart(e, "sw")}
                    onTouchStart={(e) => handleDragStart(e, "sw")}
                  />
                  <div
                    className="absolute -right-2 -bottom-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-se-resize shadow"
                    onMouseDown={(e) => handleDragStart(e, "se")}
                    onTouchStart={(e) => handleDragStart(e, "se")}
                  />
                  {/* Edge handles */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-8 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-n-resize shadow"
                    onMouseDown={(e) => handleDragStart(e, "n")}
                    onTouchStart={(e) => handleDragStart(e, "n")}
                  />
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-8 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-s-resize shadow"
                    onMouseDown={(e) => handleDragStart(e, "s")}
                    onTouchStart={(e) => handleDragStart(e, "s")}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-8 bg-blue-500 border-2 border-white rounded-sm cursor-w-resize shadow"
                    onMouseDown={(e) => handleDragStart(e, "w")}
                    onTouchStart={(e) => handleDragStart(e, "w")}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-8 bg-blue-500 border-2 border-white rounded-sm cursor-e-resize shadow"
                    onMouseDown={(e) => handleDragStart(e, "e")}
                    onTouchStart={(e) => handleDragStart(e, "e")}
                  />
                  {/* Rule of thirds */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                  </div>
                </div>
              )}
            </>
          ) : isPdf && viewMode === "grid" ? (
            // Grid view for page reordering
            <div className="w-full h-full overflow-auto pt-2">
              {/* Reset Order button */}
              {file.pageOrder && file.pageOrder.length > 0 && (
                <div className="flex justify-center mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onClearPageOrder()}
                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset Order
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 px-2">
                {(() => {
                  const hasCustomOrder = file.pageOrder && file.pageOrder.length > 0;
                  const orderedPages = hasCustomOrder
                    ? file.pageOrder!
                    : Array.from({ length: totalPages }, (_, i) => i + 1);

                  return orderedPages.map((pageNum, idx) => {
                    const isDeleted = file.deletedPages?.includes(pageNum) ?? false;
                    const isRotated = (file.pageRotations?.[pageNum] ?? 0) !== 0;
                    const isDraggingThis = draggedPage === idx;
                    const isDragOverThis = dragOverPage === idx;
                    const isEditingThis = editingPage === idx;

                    return (
                      <div
                        key={`page-${pageNum}-${idx}`}
                        draggable={!isEditingThis}
                        onDragStart={(e) => {
                          setDraggedPage(idx);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverPage(idx);
                        }}
                        onDragLeave={() => setDragOverPage(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedPage === null || draggedPage === idx) {
                            setDraggedPage(null);
                            setDragOverPage(null);
                            return;
                          }
                          // Build the new order
                          const currentOrder = hasCustomOrder
                            ? [...file.pageOrder!]
                            : Array.from({ length: totalPages }, (_, i) => i + 1);
                          const [moved] = currentOrder.splice(draggedPage, 1);
                          currentOrder.splice(idx, 0, moved);
                          onReorderPages(currentOrder);
                          setDraggedPage(null);
                          setDragOverPage(null);
                        }}
                        onDragEnd={() => {
                          setDraggedPage(null);
                          setDragOverPage(null);
                        }}
                        className={`relative rounded-lg border-2 p-2 pt-3 transition-all cursor-grab active:cursor-grabbing ${
                          isDraggingThis
                            ? "opacity-40 border-blue-400 bg-blue-50"
                            : isDragOverThis
                              ? "border-blue-500 bg-blue-50 scale-[1.03] shadow-md"
                              : isDeleted
                                ? "border-red-300 bg-red-50 opacity-50"
                                : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                        }`}
                      >
                        {/* Position badge */}
                        <div className="absolute -top-2.5 -left-2.5 z-10">
                          {isEditingThis ? (
                            <input
                              ref={orderInputRef}
                              type="number"
                              min={1}
                              max={orderedPages.length}
                              value={orderValue}
                              onChange={(e) => setOrderValue(e.target.value)}
                              onBlur={() => {
                                const newPos = parseInt(orderValue, 10);
                                if (!isNaN(newPos) && newPos >= 1 && newPos <= orderedPages.length && newPos - 1 !== idx) {
                                  const currentOrder = hasCustomOrder
                                    ? [...file.pageOrder!]
                                    : Array.from({ length: totalPages }, (_, i) => i + 1);
                                  const [moved] = currentOrder.splice(idx, 1);
                                  currentOrder.splice(newPos - 1, 0, moved);
                                  onReorderPages(currentOrder);
                                }
                                setEditingPage(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  (e.target as HTMLInputElement).blur();
                                } else if (e.key === "Escape") {
                                  setEditingPage(null);
                                }
                              }}
                              className="h-6 w-8 rounded-full border-2 border-blue-500 bg-white text-center text-xs font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setEditingPage(idx);
                                setOrderValue(String(idx + 1));
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer ring-2 ring-white"
                              title="Click to change position"
                            >
                              {idx + 1}
                            </button>
                          )}
                        </div>

                        {/* Rotation indicator */}
                        {isRotated && (
                          <div className="absolute -top-2.5 -right-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-[8px] font-bold text-white shadow-md ring-2 ring-white">
                            {file.pageRotations![pageNum]}°
                          </div>
                        )}

                        {/* Deleted indicator */}
                        {isDeleted && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-red-100/60">
                            <Trash2 className="h-6 w-6 text-red-400" />
                          </div>
                        )}

                        {/* Thumbnail image */}
                        <div className="aspect-[3/4] flex items-center justify-center overflow-hidden rounded bg-gray-50">
                          {thumbnails[pageNum] ? (
                            <img
                              src={thumbnails[pageNum]}
                              alt={`Page ${pageNum}`}
                              className="w-full h-full object-contain"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                            </div>
                          )}
                        </div>

                        {/* Page number label */}
                        <div className="mt-1.5 text-center text-[11px] text-gray-500 font-medium truncate">
                          Page {pageNum}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : isPdf ? (
            // PDF canvas-based viewer (single page)
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
                  className={`max-w-full object-contain shadow-md rounded-sm bg-white ${isEditMode ? "max-h-[calc(90vh-240px)]" : "max-h-[calc(90vh-180px)]"}`}
                />
              </div>
            )
          ) : fileSrc ? (
            // Image viewer
            <div
              style={{
                transform: `scale(${scale}) rotate(${localRotation}deg)`,
                transition: "transform 0.2s ease-in-out",
              }}
              className="origin-center"
            >
              <img
                src={fileSrc}
                alt={file.name}
                className={`max-w-full object-contain shadow-md rounded-sm ${isEditMode ? "max-h-[calc(90vh-240px)]" : "max-h-[calc(90vh-180px)]"}`}
              />
            </div>
          ) : (
            <div className="text-gray-400">Loading...</div>
          )}
        </div>

        {/* Bottom toolbar - Edit mode */}
        {isEditMode && (
          <div className="border-t border-gray-200 bg-gray-50 animate-in slide-in-from-bottom-2 duration-200">
            {isCropping ? (
              // Crop mode toolbar
              <div className="px-4 py-3 flex flex-wrap items-center justify-center gap-2 sm:justify-between sm:gap-3">
                <div className="text-xs text-gray-500 text-center sm:text-left">
                  {cropRect ? (
                    <span className="font-medium text-gray-700">
                      {Math.round(cropRect.width * 100)}% ×{" "}
                      {Math.round(cropRect.height * 100)}%
                      <span className="text-gray-400 ml-2 hidden sm:inline">
                        at ({Math.round(cropRect.x * 100)}%,{" "}
                        {Math.round(cropRect.y * 100)}%)
                      </span>
                    </span>
                  ) : (
                    "Drag to select crop area"
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetCrop}
                    disabled={!hasCurrentPageCrop}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelCrop}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyCrop}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Apply{isPdf ? ` to Page ${currentPage}` : ""}
                  </Button>
                </div>
              </div>
            ) : (
              // Normal edit toolbar
              <div className="px-4 py-3 flex flex-wrap items-center justify-center sm:justify-between gap-2">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRotate}
                    disabled={isPdf ? isCurrentPageDeleted() : false}
                    title={isPdf ? "Rotate Page 90°" : "Rotate 90°"}
                  >
                    <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                    Rotate{isPdf ? " Page" : ""}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartCrop}
                    disabled={isPdf ? isCurrentPageDeleted() : false}
                    title={isPdf ? "Crop Page" : "Crop"}
                  >
                    <Crop className="mr-1.5 h-3.5 w-3.5" />
                    Crop{isPdf ? " Page" : ""}
                  </Button>
                  {isPdf && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={
                        isCurrentPageDeleted()
                          ? handleRestorePage
                          : handleDeletePage
                      }
                      disabled={
                        !isCurrentPageDeleted() && getRemainingPagesCount() <= 1
                      }
                      className={
                        isCurrentPageDeleted()
                          ? "text-green-600 hover:bg-green-50"
                          : "text-red-600 hover:bg-red-50"
                      }
                      title={
                        isCurrentPageDeleted() ? "Restore Page" : "Delete Page"
                      }
                    >
                      {isCurrentPageDeleted() ? (
                        <>
                          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                          Restore
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete Page
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetAllEdits}
                    disabled={!hasAnyEdits}
                    className="text-gray-600"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset All
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer - Close button */}
        <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
