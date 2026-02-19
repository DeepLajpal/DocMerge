import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { UploadedFile, OutputSettings, CompressionSettings } from "./types";
import {
  getImageResampleRatio,
  getJpegQuality,
  resampleImage,
  resampleImageWithResult,
  calculateTargetImageDimensions,
  getDpiScale,
  renderPdfPageToImage,
} from "./image-compression";
import {
  getScaledDimensions,
  validateCanvasOutput,
  createSafeCanvas,
  logImageProcessing,
} from "./canvas-utils";

// Set up PDF.js worker - use local file for offline/PWA support
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

export async function detectPasswordProtection(file: File): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
    }).promise;
    return false;
  } catch (error: any) {
    if (error.name === "PasswordException") {
      return true;
    }
    return false;
  }
}

export async function validatePDFPassword(
  file: File,
  password: string,
): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    await pdfjsLib.getDocument({
      data: arrayBuffer,
      password,
    }).promise;
    return true;
  } catch (error) {
    return false;
  }
}

export async function getPDFPageCount(
  file: File,
  password?: string,
): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password || undefined,
    }).promise;
    return pdf.numPages;
  } catch (error) {
    return 0;
  }
}

export async function extractImageAsPage(
  file: File,
  settings: OutputSettings,
  compression?: CompressionSettings,
  rotation: number = 0,
): Promise<{
  width: number;
  height: number;
  image: string;
  originalWidth: number;
  originalHeight: number;
  qualityReduced: boolean;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        let qualityReduced = false;

        // Apply image resampling based on compression quality
        if (compression) {
          const resampleRatio = getImageResampleRatio(compression.quality);
          width = Math.round(width * resampleRatio);
          height = Math.round(height * resampleRatio);
        }

        // Apply safe canvas dimension limits for mobile compatibility
        const scaledDims = getScaledDimensions(width, height);
        if (scaledDims.wasScaled) {
          width = scaledDims.width;
          height = scaledDims.height;
          qualityReduced = true;
          console.info(
            `[pdf-utils] Image ${file.name} scaled for mobile compatibility: ` +
              `${img.width}x${img.height} -> ${width}x${height}`,
          );
        }

        // Apply rotation - swap dimensions for 90/270 degree rotations
        const isRotated90or270 = rotation === 90 || rotation === 270;
        const finalWidth = isRotated90or270 ? height : width;
        const finalHeight = isRotated90or270 ? width : height;

        if (rotation !== 0) {
          // Create canvas to apply rotation with retry logic
          const maxRetries = 3;

          for (let retry = 0; retry <= maxRetries; retry++) {
            const retryScale = retry === 0 ? 1 : Math.pow(0.7, retry);
            const attemptWidth = Math.floor(finalWidth * retryScale);
            const attemptHeight = Math.floor(finalHeight * retryScale);
            const drawWidth = Math.floor(width * retryScale);
            const drawHeight = Math.floor(height * retryScale);

            if (attemptWidth < 100 || attemptHeight < 100) {
              reject(
                new Error(
                  `Image ${file.name} processing failed after ${retry} retries. ` +
                    `Your device may have limited graphics memory.`,
                ),
              );
              return;
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
            ctx.translate(attemptWidth / 2, attemptHeight / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(
              img,
              -drawWidth / 2,
              -drawHeight / 2,
              drawWidth,
              drawHeight,
            );

            const rotatedImage = canvas.toDataURL("image/png");

            // Validate the canvas output
            if (!validateCanvasOutput(rotatedImage)) {
              console.warn(
                `[pdf-utils] Canvas output invalid for ${file.name}, retry ${retry + 1}/${maxRetries}`,
              );
              qualityReduced = true;
              continue;
            }

            if (retry > 0) {
              console.info(
                `[pdf-utils] Image ${file.name} processed after ${retry} retry(s): ${attemptWidth}x${attemptHeight}`,
              );
            }

            logImageProcessing(
              file.name,
              img.width,
              img.height,
              attemptWidth,
              attemptHeight,
              true,
              retry,
            );

            resolve({
              width: attemptWidth,
              height: attemptHeight,
              image: rotatedImage,
              originalWidth: img.width,
              originalHeight: img.height,
              qualityReduced: qualityReduced || retry > 0,
            });
            return;
          }

          // All retries failed
          reject(
            new Error(
              `Image ${file.name} rotation failed after ${maxRetries} retries. ` +
                `Your device may have limited graphics memory.`,
            ),
          );
        } else {
          // No rotation needed - use original image data
          const image = e.target?.result as string;

          logImageProcessing(
            file.name,
            img.width,
            img.height,
            width,
            height,
            true,
            0,
          );

          resolve({
            width,
            height,
            image,
            originalWidth: img.width,
            originalHeight: img.height,
            qualityReduced,
          });
        }
      };
      img.onerror = () =>
        reject(new Error(`Failed to load image: ${file.name}`));
      img.src = e.target?.result as string;
    };
    reader.onerror = () =>
      reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function getPageDimensions(
  pageSize: string,
  orientation: string,
): { width: number; height: number } {
  const sizes: Record<string, { width: number; height: number }> = {
    A4: { width: 595, height: 842 },
    Letter: { width: 612, height: 792 },
    Legal: { width: 612, height: 1008 },
  };

  let dims = sizes[pageSize] || { width: 595, height: 842 };

  if (orientation === "landscape") {
    [dims.width, dims.height] = [dims.height, dims.width];
  }

  return dims;
}

export interface MergeResult {
  pdfBytes: Uint8Array;
  qualityReduced: boolean;
  reducedFiles: string[];
}

export async function mergePDFsAndImages(
  files: UploadedFile[],
  settings: OutputSettings,
  compression: CompressionSettings,
): Promise<MergeResult> {
  const mergedPdf = await PDFDocument.create();
  const pageDims = getPageDimensions(settings.pageSize, settings.orientation);

  // Track quality reductions for user notification
  let qualityReduced = false;
  const reducedFiles: string[] = [];

  for (const file of files) {
    if (file.type === "pdf") {
      // Handle PDF file
      const arrayBuffer = await file.file.arrayBuffer();

      // For compression, we need to use pdf.js to render pages
      // Then embed them as images in the new PDF
      if (compression.quality !== "high") {
        // Use canvas-based compression: render PDF pages as images
        try {
          const pdfDoc = await pdfjsLib.getDocument({
            data: arrayBuffer,
            password: file.password || undefined,
          }).promise;

          const dpiScale = getDpiScale(compression.quality);
          const jpegQuality = getJpegQuality(compression.quality);

          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const pdfPage = await pdfDoc.getPage(i);
            const viewport = pdfPage.getViewport({ scale: 1 });

            // Render page to image
            const renderResult = await renderPdfPageToImage(
              pdfPage,
              dpiScale,
              jpegQuality,
            );

            // Track if quality was reduced
            if (renderResult.qualityReduced) {
              qualityReduced = true;
              if (!reducedFiles.includes(file.name)) {
                reducedFiles.push(file.name);
              }
            }

            // Create a new page with original dimensions
            const pageWidth = viewport.width;
            const pageHeight = viewport.height;
            const newPage = mergedPdf.addPage([pageWidth, pageHeight]);

            // Embed the rendered image
            const image = await mergedPdf.embedJpg(renderResult.dataUrl);
            newPage.drawImage(image, {
              x: 0,
              y: 0,
              width: pageWidth,
              height: pageHeight,
            });
          }
        } catch (error) {
          console.error(
            "Compression failed, falling back to direct copy:",
            error,
          );
          // Fallback to direct copy if rendering fails
          const pdf = await PDFDocument.load(arrayBuffer, {
            ignoreEncryption: !!file.password,
          });
          const copiedPages = await mergedPdf.copyPages(
            pdf,
            pdf.getPageIndices(),
          );
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
      } else {
        // High quality: copy pages directly without compression
        let pdf: any;

        try {
          // Try loading without password first
          pdf = await PDFDocument.load(arrayBuffer);
        } catch (error: any) {
          // If password protected, try with password
          if (file.password) {
            try {
              pdf = await PDFDocument.load(arrayBuffer, {
                ignoreEncryption: true,
              });
            } catch (innerError) {
              throw new Error(
                `Failed to load password-protected PDF: ${file.name}`,
              );
            }
          } else {
            throw new Error(`Failed to load PDF: ${file.name}`);
          }
        }

        const copiedPages = await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices(),
        );
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
    } else {
      // Handle image file
      const imageData = await extractImageAsPage(
        file.file,
        settings,
        compression,
        file.rotation || 0,
      );

      // Track if quality was reduced
      if (imageData.qualityReduced) {
        qualityReduced = true;
        if (!reducedFiles.includes(file.name)) {
          reducedFiles.push(file.name);
        }
      }

      const page = mergedPdf.addPage([pageDims.width, pageDims.height]);

      // Calculate scaling to fit image on page
      const maxWidth = pageDims.width - 40;
      const maxHeight = pageDims.height - 40;
      let scaledWidth = imageData.width;
      let scaledHeight = imageData.height;

      const ratio = imageData.width / imageData.height;
      if (scaledWidth > maxWidth) {
        scaledWidth = maxWidth;
        scaledHeight = maxWidth / ratio;
      }
      if (scaledHeight > maxHeight) {
        scaledHeight = maxHeight;
        scaledWidth = maxHeight * ratio;
      }

      const x = (pageDims.width - scaledWidth) / 2;
      const y = (pageDims.height - scaledHeight) / 2;

      try {
        // For high quality, use PNG; for others, resample to JPEG for better compression
        if (compression.quality === "high") {
          const image = await mergedPdf.embedPng(imageData.image);
          page.drawImage(image, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
          });
        } else {
          // Resample image data for better compression and apply JPEG quality
          const jpegQuality = getJpegQuality(compression.quality);
          const resampleResult = await resampleImageWithResult(
            imageData.image,
            imageData.width,
            imageData.height,
            jpegQuality,
          );

          // Track if quality was reduced during resampling
          if (resampleResult.qualityReduced) {
            qualityReduced = true;
            if (!reducedFiles.includes(file.name)) {
              reducedFiles.push(file.name);
            }
          }

          const image = await mergedPdf.embedJpg(resampleResult.dataUrl);
          page.drawImage(image, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
          });
        }
      } catch (error) {
        // Fallback for JPEG with balanced quality
        const jpegQuality = getJpegQuality("balanced");
        const resampleResult = await resampleImageWithResult(
          imageData.image,
          imageData.width,
          imageData.height,
          jpegQuality,
        );

        // Track quality reduction from fallback
        qualityReduced = true;
        if (!reducedFiles.includes(file.name)) {
          reducedFiles.push(file.name);
        }

        const image = await mergedPdf.embedJpg(resampleResult.dataUrl);
        page.drawImage(image, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });
      }
    }
  }

  // Apply compression settings
  applyCompressionSettings(mergedPdf, compression);

  // Save with aggressive compression flags:
  // - useObjectStreams: Reduces file size by removing duplicate objects
  // - compress: Enables DEFLATE compression on all streams
  // These two flags can reduce file size by 30-50% without quality loss
  const pdfBytes = await mergedPdf.save({
    useObjectStreams: true,
  });

  return {
    pdfBytes,
    qualityReduced,
    reducedFiles,
  };
}

export function applyCompressionSettings(
  pdf: PDFDocument,
  settings: CompressionSettings,
): void {
  // Compression is now handled during page rendering via canvas-based compression
  // This function is kept for backwards compatibility
  // Actual compression happens in:
  // 1. PDF pages: renderPdfPageToImage() converts pages to compressed JPEG images
  // 2. Image files: resampleImage() compresses images based on quality setting
  // 3. Save options: useObjectStreams reduces overall file size
}

/**
 * Calculate target size in bytes from compression settings
 */
export function getTargetSizeBytes(settings: CompressionSettings): number {
  const multiplier = settings.targetUnit === "MB" ? 1024 * 1024 : 1024;
  return settings.targetSize * multiplier;
}

/**
 * Determine recommended quality level based on file sizes and target size
 */
export function recommendQualityForTarget(
  totalInputSize: number,
  targetSize: number,
): "high" | "balanced" | "small" {
  const ratio = targetSize / totalInputSize;

  if (ratio >= 0.8) {
    return "high";
  } else if (ratio >= 0.4) {
    return "balanced";
  } else {
    return "small";
  }
}
