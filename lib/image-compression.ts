import { CompressionSettings } from "./types";

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
 */
export async function resampleImage(
  imageDataUrl: string,
  targetWidth: number,
  targetHeight: number,
  jpegQuality: number = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Use high-quality image smoothing for better visual results
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw the image scaled to target dimensions
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convert to JPEG with specified quality for better compression
        const resampledUrl = canvas.toDataURL("image/jpeg", jpegQuality);
        resolve(resampledUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () =>
      reject(new Error("Failed to load image for resampling"));
    img.src = imageDataUrl;
  });
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
 */
export async function renderPdfPageToImage(
  pdfPage: any,
  scale: number,
  jpegQuality: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const viewport = pdfPage.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Render the PDF page to canvas
  await pdfPage.render({
    canvasContext: ctx,
    viewport: viewport,
  }).promise;

  // Convert to JPEG with specified quality
  const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);

  return {
    dataUrl,
    width: viewport.width,
    height: viewport.height,
  };
}
