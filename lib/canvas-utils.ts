/**
 * Canvas utilities for handling mobile device limitations
 *
 * Mobile browsers (especially older Android WebView like on Oppo F11) have hardware
 * limits on canvas dimensions. When exceeded, canvas.toDataURL() silently returns
 * empty/minimal data, causing black pages in PDFs.
 *
 * This module provides:
 * - Safe dimension calculation respecting device limits
 * - Output validation to detect canvas failures
 * - Progressive retry logic with automatic quality reduction
 */

// Conservative limits for mobile compatibility
// These values work on most devices including older Android (4096x4096 = 16MP)
export const MAX_CANVAS_DIMENSION = 4096;
export const MAX_CANVAS_AREA = 16777216; // 4096 * 4096

// Minimum valid data URL length - empty canvas produces ~22 chars ("data:image/png;base64,")
// A valid image with content should be at least 1000 chars
const MIN_VALID_DATAURL_LENGTH = 1000;

// Empty or failed data URL patterns
const INVALID_DATAURL_PATTERNS = [
  "data:,",
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
];

export interface ScaledDimensions {
  width: number;
  height: number;
  wasScaled: boolean;
  scaleFactor: number;
}

export interface CanvasResult {
  dataUrl: string;
  qualityReduced: boolean;
  originalWidth: number;
  originalHeight: number;
  finalWidth: number;
  finalHeight: number;
  retryCount: number;
}

/**
 * Calculate safe dimensions that respect mobile canvas limits
 * Returns scaled dimensions if the original exceeds limits
 */
export function getScaledDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_CANVAS_DIMENSION,
  maxArea: number = MAX_CANVAS_AREA,
): ScaledDimensions {
  const area = width * height;

  // Check if scaling is needed
  if (area <= maxArea && width <= maxDimension && height <= maxDimension) {
    return {
      width,
      height,
      wasScaled: false,
      scaleFactor: 1,
    };
  }

  // Calculate scale factor to fit within limits
  let scaleFactor = 1;

  // Scale down for max dimension
  if (width > maxDimension) {
    scaleFactor = Math.min(scaleFactor, maxDimension / width);
  }
  if (height > maxDimension) {
    scaleFactor = Math.min(scaleFactor, maxDimension / height);
  }

  // Scale down for max area
  if (area * scaleFactor * scaleFactor > maxArea) {
    scaleFactor = Math.sqrt(maxArea / area);
  }

  // Apply scale with some safety margin (95% of calculated)
  scaleFactor *= 0.95;

  const newWidth = Math.floor(width * scaleFactor);
  const newHeight = Math.floor(height * scaleFactor);

  return {
    width: Math.max(1, newWidth),
    height: Math.max(1, newHeight),
    wasScaled: true,
    scaleFactor,
  };
}

/**
 * Validate that a canvas data URL contains actual image data
 * Returns false if the canvas operation likely failed
 */
export function validateCanvasOutput(
  dataUrl: string | null | undefined,
): boolean {
  // Null/undefined check
  if (!dataUrl) {
    return false;
  }

  // Check for empty/minimal data URL patterns
  for (const pattern of INVALID_DATAURL_PATTERNS) {
    if (
      dataUrl === pattern ||
      (dataUrl.startsWith(pattern) && dataUrl.length < MIN_VALID_DATAURL_LENGTH)
    ) {
      return false;
    }
  }

  // Check minimum length for valid image data
  if (dataUrl.length < MIN_VALID_DATAURL_LENGTH) {
    return false;
  }

  // Check for proper base64 data URL format
  if (!dataUrl.startsWith("data:image/")) {
    return false;
  }

  return true;
}

/**
 * Create a canvas with the specified dimensions
 * Validates that the canvas was created successfully
 */
export function createSafeCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[canvas-utils] Failed to get 2d context");
      return null;
    }

    return { canvas, ctx };
  } catch (error) {
    console.warn("[canvas-utils] Failed to create canvas:", error);
    return null;
  }
}

/**
 * Draw an image to canvas with white background and return validated data URL
 * Handles rotation if specified
 */
export function drawImageToCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  rotation: number = 0,
  jpegQuality: number = 0.85,
): string | null {
  try {
    // Fill with white background to prevent black pages
    // (canvas defaults to transparent black, which becomes solid black in JPEG)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (rotation !== 0) {
      // Handle rotation
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // For 90/270 degree rotations, swap target dimensions for drawing
      const isRotated90or270 = rotation === 90 || rotation === 270;
      const drawWidth = isRotated90or270 ? targetHeight : targetWidth;
      const drawHeight = isRotated90or270 ? targetWidth : targetHeight;

      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight,
      );
      ctx.restore();
    } else {
      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    }

    // Convert to data URL
    const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);

    // Validate output
    if (!validateCanvasOutput(dataUrl)) {
      console.warn("[canvas-utils] Canvas produced invalid output");
      return null;
    }

    return dataUrl;
  } catch (error) {
    console.warn("[canvas-utils] Error drawing image to canvas:", error);
    return null;
  }
}

/**
 * Process an image with automatic retry at reduced sizes if canvas fails
 * This is the main entry point for safe image processing
 */
export async function processImageWithRetry(
  imageDataUrl: string,
  targetWidth: number,
  targetHeight: number,
  jpegQuality: number = 0.85,
  rotation: number = 0,
  maxRetries: number = 3,
): Promise<CanvasResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      let currentWidth = targetWidth;
      let currentHeight = targetHeight;
      let retryCount = 0;
      let qualityReduced = false;

      // Apply initial safe scaling
      const initialScaled = getScaledDimensions(currentWidth, currentHeight);
      if (initialScaled.wasScaled) {
        currentWidth = initialScaled.width;
        currentHeight = initialScaled.height;
        qualityReduced = true;
        console.info(
          `[canvas-utils] Initial scaling applied: ${targetWidth}x${targetHeight} -> ${currentWidth}x${currentHeight}`,
        );
      }

      // Handle rotation dimension swap
      const isRotated90or270 = rotation === 90 || rotation === 270;
      const canvasWidth = isRotated90or270 ? currentHeight : currentWidth;
      const canvasHeight = isRotated90or270 ? currentWidth : currentHeight;

      while (retryCount <= maxRetries) {
        // Calculate canvas dimensions for this attempt
        const attemptWidth = Math.floor(
          canvasWidth * Math.pow(0.7, retryCount),
        );
        const attemptHeight = Math.floor(
          canvasHeight * Math.pow(0.7, retryCount),
        );

        if (attemptWidth < 100 || attemptHeight < 100) {
          reject(
            new Error(
              `Image processing failed after ${retryCount} retries. ` +
                `Your device may not support processing this image. ` +
                `Original size: ${targetWidth}x${targetHeight}`,
            ),
          );
          return;
        }

        const canvasResult = createSafeCanvas(attemptWidth, attemptHeight);
        if (!canvasResult) {
          retryCount++;
          qualityReduced = true;
          continue;
        }

        const { canvas, ctx } = canvasResult;
        const dataUrl = drawImageToCanvas(
          canvas,
          ctx,
          img,
          isRotated90or270 ? attemptHeight : attemptWidth,
          isRotated90or270 ? attemptWidth : attemptHeight,
          rotation,
          jpegQuality,
        );

        if (dataUrl) {
          if (retryCount > 0) {
            console.info(
              `[canvas-utils] Image processed after ${retryCount} retry(s): ` +
                `${targetWidth}x${targetHeight} -> ${attemptWidth}x${attemptHeight}`,
            );
          }

          resolve({
            dataUrl,
            qualityReduced: qualityReduced || retryCount > 0,
            originalWidth: targetWidth,
            originalHeight: targetHeight,
            finalWidth: attemptWidth,
            finalHeight: attemptHeight,
            retryCount,
          });
          return;
        }

        // Canvas failed, try with smaller dimensions
        retryCount++;
        qualityReduced = true;
        console.warn(
          `[canvas-utils] Canvas failed, retrying with smaller size (attempt ${retryCount}/${maxRetries})`,
        );
      }

      reject(
        new Error(
          `Image processing failed after ${maxRetries} retries. ` +
            `Your device may have limited graphics memory. ` +
            `Try using smaller images.`,
        ),
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image for processing"));
    };

    img.src = imageDataUrl;
  });
}

/**
 * Quick test to check device canvas capabilities
 * Can be called at app startup to detect limitations early
 */
export async function testCanvasCapabilities(): Promise<{
  maxSafeSize: number;
  supportsLargeCanvas: boolean;
  recommendedMaxDimension: number;
}> {
  const testSizes = [8192, 4096, 2048, 1024];
  let maxSafeSize = 1024;

  for (const size of testSizes) {
    try {
      const canvasResult = createSafeCanvas(size, size);
      if (!canvasResult) continue;

      const { canvas, ctx } = canvasResult;

      // Draw a test pattern
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, size, size);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
      if (validateCanvasOutput(dataUrl)) {
        maxSafeSize = size;
        break;
      }
    } catch {
      // This size doesn't work, try smaller
      continue;
    }
  }

  return {
    maxSafeSize,
    supportsLargeCanvas: maxSafeSize >= 4096,
    recommendedMaxDimension: Math.min(maxSafeSize, MAX_CANVAS_DIMENSION),
  };
}

/**
 * Log image processing details for debugging
 */
export function logImageProcessing(
  filename: string,
  originalWidth: number,
  originalHeight: number,
  finalWidth: number,
  finalHeight: number,
  success: boolean,
  retryCount: number = 0,
): void {
  const wasScaled =
    originalWidth !== finalWidth || originalHeight !== finalHeight;
  const status = success ? "✓" : "✗";
  const scaleInfo = wasScaled
    ? ` (scaled from ${originalWidth}x${originalHeight})`
    : "";
  const retryInfo = retryCount > 0 ? ` [${retryCount} retries]` : "";

  console.info(
    `[canvas-utils] ${status} ${filename}: ${finalWidth}x${finalHeight}${scaleInfo}${retryInfo}`,
  );
}
