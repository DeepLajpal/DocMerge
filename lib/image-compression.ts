import { CompressionSettings, CropData } from "./types";
import {
  getScaledDimensions,
  validateCanvasOutput,
  createSafeCanvas,
  processImageWithRetry,
  logImageProcessing,
  type CanvasResult,
} from "./canvas-utils";

// Re-export CanvasResult type for consumers
export type { CanvasResult };

/**
 * Get the image resampling ratio based on compression quality setting
 * This affects how much the image dimensions are reduced before embedding
 */
export function getImageResampleRatio(quality: string): number {
  switch (quality) {
    case "high":
      return 1; // No resampling, preserve original
    case "balanced":
      return 0.75; // 75% of original size
    case "small":
      return 0.5; // 50% of original size
    default:
      return 1;
  }
}

/**
 * Get JPEG quality parameter based on compression setting
 * Higher values preserve more detail but increase file size
 */
export function getJpegQuality(quality: string): number {
  switch (quality) {
    case "high":
      return 0.95; // Near-lossless
    case "balanced":
      return 0.85; // Good balance
    case "small":
      return 0.75; // More compression
    default:
      return 0.85;
  }
}

/**
 * Resample an image to a target size using canvas
 * This reduces memory footprint and file size when embedded in PDF
 * Now includes validation and automatic retry for mobile device compatibility
 */
export async function resampleImage(
  imageDataUrl: string,
  targetWidth: number,
  targetHeight: number,
  jpegQuality: number = 0.85,
): Promise<string> {
  const result = await resampleImageWithResult(
    imageDataUrl,
    targetWidth,
    targetHeight,
    jpegQuality,
  );
  return result.dataUrl;
}

/**
 * Resample an image with detailed result including quality reduction info
 * Use this when you need to track if quality was reduced for user notification
 */
export async function resampleImageWithResult(
  imageDataUrl: string,
  targetWidth: number,
  targetHeight: number,
  jpegQuality: number = 0.85,
  rotation: number = 0,
): Promise<CanvasResult> {
  try {
    const result = await processImageWithRetry(
      imageDataUrl,
      targetWidth,
      targetHeight,
      jpegQuality,
      rotation,
    );

    logImageProcessing(
      "image",
      targetWidth,
      targetHeight,
      result.finalWidth,
      result.finalHeight,
      true,
      result.retryCount,
    );

    return result;
  } catch (error) {
    logImageProcessing("image", targetWidth, targetHeight, 0, 0, false);
    throw error;
  }
}

/**
 * Calculate target image dimensions based on compression quality
 * Returns dimensions that will be used for embedding the image in the PDF
 */
export function calculateTargetImageDimensions(
  originalWidth: number,
  originalHeight: number,
  quality: string,
): { width: number; height: number } {
  const ratio = getImageResampleRatio(quality);
  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
}

/**
 * Estimate compression savings for different quality levels
 * Used for user feedback about file size impact
 */
export function estimateCompressionRatio(quality: string): {
  ratio: number;
  percentage: string;
} {
  switch (quality) {
    case "high":
      return { ratio: 1, percentage: "0%" };
    case "balanced":
      return { ratio: 0.6, percentage: "40%" };
    case "small":
      return { ratio: 0.3, percentage: "70%" };
    default:
      return { ratio: 1, percentage: "0%" };
  }
}

/**
 * Get DPI scale factor based on compression quality
 * Higher DPI = better quality but larger file
 */
export function getDpiScale(quality: string): number {
  switch (quality) {
    case "high":
      return 2.0; // 144 DPI (72 * 2)
    case "balanced":
      return 1.5; // 108 DPI
    case "small":
      return 1.0; // 72 DPI
    default:
      return 1.5;
  }
}

/**
 * Render a PDF page to a canvas and return as JPEG data URL
 * This enables compression of PDF pages by re-rendering them as images
 * Includes validation and automatic scaling for mobile device compatibility
 */
export async function renderPdfPageToImage(
  pdfPage: any,
  scale: number,
  jpegQuality: number,
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  qualityReduced: boolean;
}> {
  const viewport = pdfPage.getViewport({ scale });

  // Check if dimensions need scaling for mobile compatibility
  let targetWidth = viewport.width;
  let targetHeight = viewport.height;
  let qualityReduced = false;
  let currentScale = scale;

  const scaled = getScaledDimensions(targetWidth, targetHeight);
  if (scaled.wasScaled) {
    targetWidth = scaled.width;
    targetHeight = scaled.height;
    currentScale = scale * scaled.scaleFactor;
    qualityReduced = true;
    console.info(
      `[image-compression] PDF page scaled for mobile compatibility: ` +
        `${Math.round(viewport.width)}x${Math.round(viewport.height)} -> ${targetWidth}x${targetHeight}`,
    );
  }

  // Try rendering with progressively smaller sizes
  const maxRetries = 3;
  for (let retry = 0; retry <= maxRetries; retry++) {
    const retryScale = retry === 0 ? 1 : Math.pow(0.7, retry);
    const attemptWidth = Math.floor(targetWidth * retryScale);
    const attemptHeight = Math.floor(targetHeight * retryScale);

    if (attemptWidth < 100 || attemptHeight < 100) {
      throw new Error(
        `PDF page rendering failed after ${retry} retries. ` +
          `Your device may have limited graphics memory.`,
      );
    }

    const canvasResult = createSafeCanvas(attemptWidth, attemptHeight);
    if (!canvasResult) {
      qualityReduced = true;
      continue;
    }

    const { canvas, ctx } = canvasResult;

    // Fill with white background to prevent black pages on mobile browsers
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, attemptWidth, attemptHeight);

    // Get viewport for current attempt size
    const attemptViewport = pdfPage.getViewport({
      scale: currentScale * retryScale,
    });

    try {
      // Render the PDF page to canvas
      await pdfPage.render({
        canvasContext: ctx,
        viewport: attemptViewport,
      }).promise;

      // Convert to JPEG with specified quality
      const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);

      // Validate the output
      if (!validateCanvasOutput(dataUrl)) {
        console.warn(
          `[image-compression] PDF page canvas output invalid, retry ${retry + 1}/${maxRetries}`,
        );
        qualityReduced = true;
        continue;
      }

      if (retry > 0) {
        console.info(
          `[image-compression] PDF page rendered after ${retry} retry(s): ${attemptWidth}x${attemptHeight}`,
        );
      }

      return {
        dataUrl,
        width: attemptWidth,
        height: attemptHeight,
        qualityReduced: qualityReduced || retry > 0,
      };
    } catch (renderError) {
      console.warn(
        `[image-compression] PDF page render failed, retry ${retry + 1}/${maxRetries}:`,
        renderError,
      );
      qualityReduced = true;
    }
  }

  throw new Error(
    `PDF page rendering failed after ${maxRetries} retries. ` +
      `Your device may have limited graphics memory.`,
  );
}

/**
 * Render a PDF page to an image with optional cropping
 * This enables cropping and compression of PDF pages
 */
export async function renderPdfPageToImageWithCrop(
  pdfPage: any,
  scale: number,
  jpegQuality: number,
  cropData?: CropData,
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  qualityReduced: boolean;
}> {
  // If no crop, use the standard function
  if (!cropData) {
    return renderPdfPageToImage(pdfPage, scale, jpegQuality);
  }

  const viewport = pdfPage.getViewport({ scale });

  // Calculate cropped dimensions
  const fullWidth = viewport.width;
  const fullHeight = viewport.height;
  const cropX = Math.round(cropData.x * fullWidth);
  const cropY = Math.round(cropData.y * fullHeight);
  const cropWidth = Math.round(cropData.width * fullWidth);
  const cropHeight = Math.round(cropData.height * fullHeight);

  // Check if dimensions need scaling for mobile compatibility
  let targetWidth = cropWidth;
  let targetHeight = cropHeight;
  let qualityReduced = false;

  const scaled = getScaledDimensions(targetWidth, targetHeight);
  if (scaled.wasScaled) {
    targetWidth = scaled.width;
    targetHeight = scaled.height;
    qualityReduced = true;
    console.info(
      `[image-compression] Cropped PDF page scaled for mobile compatibility: ` +
        `${cropWidth}x${cropHeight} -> ${targetWidth}x${targetHeight}`,
    );
  }

  // Try rendering with progressively smaller sizes
  const maxRetries = 3;
  for (let retry = 0; retry <= maxRetries; retry++) {
    const retryScale = retry === 0 ? 1 : Math.pow(0.7, retry);
    const attemptWidth = Math.floor(targetWidth * retryScale);
    const attemptHeight = Math.floor(targetHeight * retryScale);

    if (attemptWidth < 100 || attemptHeight < 100) {
      throw new Error(
        `Cropped PDF page rendering failed after ${retry} retries. ` +
          `Your device may have limited graphics memory.`,
      );
    }

    // First render the full page to a temp canvas
    const fullCanvasResult = createSafeCanvas(
      Math.floor(fullWidth * retryScale),
      Math.floor(fullHeight * retryScale)
    );
    if (!fullCanvasResult) {
      qualityReduced = true;
      continue;
    }

    const { canvas: fullCanvas, ctx: fullCtx } = fullCanvasResult;

    // Fill with white background
    fullCtx.fillStyle = "#ffffff";
    fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);

    // Get viewport for current attempt size
    const attemptViewport = pdfPage.getViewport({
      scale: scale * retryScale,
    });

    try {
      // Render the full PDF page
      await pdfPage.render({
        canvasContext: fullCtx,
        viewport: attemptViewport,
      }).promise;

      // Now create a crop canvas and extract the cropped region
      const cropCanvasResult = createSafeCanvas(attemptWidth, attemptHeight);
      if (!cropCanvasResult) {
        qualityReduced = true;
        continue;
      }

      const { canvas: cropCanvas, ctx: cropCtx } = cropCanvasResult;

      // Fill with white background
      cropCtx.fillStyle = "#ffffff";
      cropCtx.fillRect(0, 0, attemptWidth, attemptHeight);

      // Draw the cropped region from the full canvas
      const srcX = Math.round(cropX * retryScale);
      const srcY = Math.round(cropY * retryScale);
      const srcW = Math.round(cropWidth * retryScale);
      const srcH = Math.round(cropHeight * retryScale);

      cropCtx.drawImage(
        fullCanvas,
        srcX, srcY, srcW, srcH,
        0, 0, attemptWidth, attemptHeight
      );

      // Convert to JPEG with specified quality
      const dataUrl = cropCanvas.toDataURL("image/jpeg", jpegQuality);

      // Validate the output
      if (!validateCanvasOutput(dataUrl)) {
        console.warn(
          `[image-compression] Cropped PDF page canvas output invalid, retry ${retry + 1}/${maxRetries}`,
        );
        qualityReduced = true;
        continue;
      }

      if (retry > 0) {
        console.info(
          `[image-compression] Cropped PDF page rendered after ${retry} retry(s): ${attemptWidth}x${attemptHeight}`,
        );
      }

      return {
        dataUrl,
        width: attemptWidth,
        height: attemptHeight,
        qualityReduced: qualityReduced || retry > 0,
      };
    } catch (renderError) {
      console.warn(
        `[image-compression] Cropped PDF page render failed, retry ${retry + 1}/${maxRetries}:`,
        renderError,
      );
      qualityReduced = true;
    }
  }

  throw new Error(
    `Cropped PDF page rendering failed after ${maxRetries} retries. ` +
      `Your device may have limited graphics memory.`,
  );
}
