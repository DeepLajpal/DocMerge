"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Crop, RotateCcw, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UploadedFile, CropData } from "@/lib/types";

interface ImageCropModalProps {
  file: UploadedFile;
  onApply: (cropData: CropData) => void;
  onReset: () => void;
  onClose: () => void;
}

export function ImageCropModal({
  file,
  onApply,
  onReset,
  onClose,
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Crop selection in pixel coordinates (relative to displayed image)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Display dimensions of the image on canvas
  const [displayRect, setDisplayRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Load the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImgElement(img);
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load image for cropping");
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file.file);
  }, [file.file]);

  // Draw image and crop overlay on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !imgElement) return;

    const container = containerRef.current;
    if (!container) return;

    // Size canvas to container
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Calculate image display size (fit inside canvas with padding)
    const padding = 16;
    const maxW = containerWidth - padding * 2;
    const maxH = containerHeight - padding * 2;
    const imgRatio = imgElement.width / imgElement.height;

    let drawW = maxW;
    let drawH = maxW / imgRatio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = maxH * imgRatio;
    }

    const drawX = (containerWidth - drawW) / 2;
    const drawY = (containerHeight - drawH) / 2;

    setDisplayRect({ x: drawX, y: drawY, w: drawW, h: drawH });

    // Clear and draw checkerboard background
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    // Draw the image
    ctx.drawImage(imgElement, drawX, drawY, drawW, drawH);

    // Draw crop overlay if we have a selection
    if (cropStart && cropEnd) {
      const sx = Math.min(cropStart.x, cropEnd.x);
      const sy = Math.min(cropStart.y, cropEnd.y);
      const sw = Math.abs(cropEnd.x - cropStart.x);
      const sh = Math.abs(cropEnd.y - cropStart.y);

      // Darken everything outside the crop area
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      // Top
      ctx.fillRect(drawX, drawY, drawW, sy - drawY);
      // Bottom
      ctx.fillRect(drawX, sy + sh, drawW, drawY + drawH - sy - sh);
      // Left
      ctx.fillRect(drawX, sy, sx - drawX, sh);
      // Right
      ctx.fillRect(sx + sw, sy, drawX + drawW - sx - sw, sh);

      // Draw crop border
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);

      // Draw corner handles
      const handleSize = 8;
      ctx.fillStyle = "#3b82f6";
      const corners = [
        [sx, sy],
        [sx + sw, sy],
        [sx, sy + sh],
        [sx + sw, sy + sh],
      ];
      corners.forEach(([cx, cy]) => {
        ctx.fillRect(
          cx - handleSize / 2,
          cy - handleSize / 2,
          handleSize,
          handleSize
        );
      });

      // Draw rule of thirds lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + (sw * i) / 3, sy);
        ctx.lineTo(sx + (sw * i) / 3, sy + sh);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy + (sh * i) / 3);
        ctx.lineTo(sx + sw, sy + (sh * i) / 3);
        ctx.stroke();
      }
    }
  }, [imgElement, cropStart, cropEnd]);

  // Redraw when dependencies change
  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, drawCanvas]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      // Reset crop on resize to avoid coordinate mismatch
      setCropStart(null);
      setCropEnd(null);
      drawCanvas();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawCanvas]);

  // Initialize crop from existing cropData
  useEffect(() => {
    if (imageLoaded && file.cropData && displayRect.w > 0) {
      const cd = file.cropData;
      setCropStart({
        x: displayRect.x + cd.x * displayRect.w,
        y: displayRect.y + cd.y * displayRect.h,
      });
      setCropEnd({
        x: displayRect.x + (cd.x + cd.width) * displayRect.w,
        y: displayRect.y + (cd.y + cd.height) * displayRect.h,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageLoaded, displayRect.w]);

  // Clamp point to image bounds
  const clampToImage = (px: number, py: number) => ({
    x: Math.max(displayRect.x, Math.min(px, displayRect.x + displayRect.w)),
    y: Math.max(displayRect.y, Math.min(py, displayRect.y + displayRect.h)),
  });

  // Get coordinates from mouse/touch event
  const getEventCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getEventCoords(e);
    const clamped = clampToImage(coords.x, coords.y);
    setCropStart(clamped);
    setCropEnd(clamped);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const coords = getEventCoords(e);
    const clamped = clampToImage(coords.x, coords.y);
    setCropEnd(clamped);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Convert pixel crop to percentage-based CropData
  const getCropData = (): CropData | null => {
    if (!cropStart || !cropEnd || displayRect.w === 0) return null;

    const sx = Math.min(cropStart.x, cropEnd.x) - displayRect.x;
    const sy = Math.min(cropStart.y, cropEnd.y) - displayRect.y;
    const sw = Math.abs(cropEnd.x - cropStart.x);
    const sh = Math.abs(cropEnd.y - cropStart.y);

    // Minimum crop size (at least 5% of image)
    if (sw / displayRect.w < 0.05 || sh / displayRect.h < 0.05) return null;

    return {
      x: sx / displayRect.w,
      y: sy / displayRect.h,
      width: sw / displayRect.w,
      height: sh / displayRect.h,
    };
  };

  const handleApply = () => {
    const cropData = getCropData();
    if (cropData) {
      onApply(cropData);
      onClose();
    }
  };

  const handleReset = () => {
    setCropStart(null);
    setCropEnd(null);
    onReset();
  };

  const cropData = getCropData();
  const hasCrop = cropData !== null;

  // Calculate display dimensions for info
  const cropInfo = cropData && imgElement
    ? {
        x: Math.round(cropData.x * imgElement.width),
        y: Math.round(cropData.y * imgElement.height),
        w: Math.round(cropData.width * imgElement.width),
        h: Math.round(cropData.height * imgElement.height),
      }
    : null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crop className="h-4 w-4 text-blue-600" />
            Crop Image — {file.name}
          </DialogTitle>
        </DialogHeader>

        {/* Crop canvas area */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[300px] max-h-[60vh] mx-5 rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              Loading image...
            </div>
          )}
        </div>

        {/* Crop info + actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {cropInfo ? (
              <span className="font-medium text-gray-700">
                {cropInfo.w} × {cropInfo.h}px
                <span className="text-gray-400 ml-1.5">
                  at ({cropInfo.x}, {cropInfo.y})
                </span>
              </span>
            ) : (
              <span>Click and drag on the image to select a crop area</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!hasCrop && !file.cropData}
              className="text-gray-600"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!hasCrop}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Apply Crop
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
