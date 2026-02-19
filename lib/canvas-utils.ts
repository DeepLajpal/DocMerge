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
 * Validate canvas pixels to detect black/empty canvas output
 * This is crucial for devices like Oppo F11 where toDataURL returns valid format but black pixels
 * Samples pixels from multiple regions and checks if they're mostly non-black
 */
export function validateCanvasPixels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  try {
    // Sample pixels from 9 different regions (3x3 grid + center)
    const samplePoints = [
      { x: Math.floor(width * 0.25), y: Math.floor(height * 0.25) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.25) },
      { x: Math.floor(width * 0.75), y: Math.floor(height * 0.25) },
      { x: Math.floor(width * 0.25), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.75), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.25), y: Math.floor(height * 0.75) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.75) },
      { x: Math.floor(width * 0.75), y: Math.floor(height * 0.75) },
    ];

    let nonBlackPixels = 0;
    let totalSampled = 0;

    for (const point of samplePoints) {
      // Sample a small area around each point
      const sampleSize = Math.min(
        10,
        Math.floor(width / 20),
        Math.floor(height / 20),
      );
      if (sampleSize < 1) continue;

      try {
        const imageData = ctx.getImageData(
          Math.max(0, point.x - sampleSize / 2),
          Math.max(0, point.y - sampleSize / 2),
          Math.min(sampleSize, width - point.x),
          Math.min(sampleSize, height - point.y),
        );

        // Check pixels in this sample
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];

          totalSampled++;

          // Consider a pixel "non-black" if:
          // - It has any significant color (R, G, or B > 10)
          // - OR it's white/light colored (our background fill)
          // - AND it has opacity
          if (a > 0 && (r > 10 || g > 10 || b > 10)) {
            nonBlackPixels++;
          }
        }
      } catch (sampleError) {
        // getImageData can fail on tainted canvases or memory issues
        console.warn("[canvas-utils] getImageData failed:", sampleError);
        // If we can't sample, we can't validate - assume failure
        return false;
      }
    }

    // If we couldn't sample any pixels, assume failure
    if (totalSampled === 0) {
      console.warn("[canvas-utils] No pixels sampled, assuming canvas failure");
      return false;
    }

    // Calculate the percentage of non-black pixels
    const nonBlackRatio = nonBlackPixels / totalSampled;

    // We expect at least 20% of sampled pixels to be non-black
    // (accounting for potential dark areas in legitimate images)
    // But since we fill with white first, most pixels should be white/colored
    const isValid = nonBlackRatio > 0.2;

    if (!isValid) {
      console.warn(
        `[canvas-utils] Canvas pixel validation failed: only ${(nonBlackRatio * 100).toFixed(1)}% non-black pixels ` +
          `(sampled ${totalSampled} pixels)`,
      );
    }

    return isValid;
  } catch (error) {
    console.warn("[canvas-utils] Pixel validation error:", error);
    return false;
  }
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
 * Now includes pixel-level validation to detect black canvas on mobile devices
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

    // CRITICAL: Validate pixel content BEFORE calling toDataURL
    // This catches the Oppo F11 issue where canvas draws but produces black pixels
    if (!validateCanvasPixels(ctx, canvas.width, canvas.height)) {
      console.warn(
        "[canvas-utils] Canvas pixel validation failed - canvas produced black/empty output",
      );
      return null;
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
