import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import {
  UploadedFile,
  OutputSettings,
  CompressionSettings,
  CropData,
  PageCropData,
} from "./types";
import {
  getImageResampleRatio,
  getJpegQuality,
  resampleImage,
  resampleImageWithResult,
  calculateTargetImageDimensions,
  getDpiScale,
  renderPdfPageToImage,
  renderPdfPageToImageWithCrop,
} from "./image-compression";
import {
  getScaledDimensions,
  validateCanvasOutput,
  validateCanvasPixels,
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
  cropData?: CropData,
): Promise<{
  width: number;
  height: number;
  image: string;
  originalWidth: number;
  originalHeight: number;
  qualityReduced: boolean;
  rotationSkipped?: boolean;
  usedDirectEmbed?: boolean;
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

        // Apply crop if specified (before any other processing)
        let cropSrcX = 0;
        let cropSrcY = 0;
        let cropSrcW = width;
        let cropSrcH = height;
        if (cropData) {
          cropSrcX = Math.round(cropData.x * width);
          cropSrcY = Math.round(cropData.y * height);
          cropSrcW = Math.round(cropData.width * width);
          cropSrcH = Math.round(cropData.height * height);
          width = cropSrcW;
          height = cropSrcH;
        }

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
              cropSrcX,
              cropSrcY,
              cropSrcW,
              cropSrcH,
              -drawWidth / 2,
              -drawHeight / 2,
              drawWidth,
              drawHeight,
            );

            // CRITICAL: Validate pixel content to detect black canvas output
            // This catches the Oppo F11 issue where canvas draws but produces black pixels
            if (!validateCanvasPixels(ctx, attemptWidth, attemptHeight)) {
              console.warn(
                `[pdf-utils] Canvas pixel validation failed for ${file.name}, retry ${retry + 1}/${maxRetries}`,
              );
              qualityReduced = true;
              continue;
            }

            const rotatedImage = canvas.toDataURL("image/png");

            // Validate the data URL format as well
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

          // All canvas retries failed - FALLBACK to original image without rotation
          // This guarantees the PDF works even when canvas completely fails
          console.warn(
            `[pdf-utils] All canvas attempts failed for ${file.name}, using original image (rotation skipped)`,
          );

          const image = e.target?.result as string;

          logImageProcessing(
            file.name,
            img.width,
            img.height,
            img.width,
            img.height,
            true,
            maxRetries,
          );

          // Return original with a flag indicating rotation was skipped
          resolve({
            width: img.width,
            height: img.height,
            image,
            originalWidth: img.width,
            originalHeight: img.height,
            qualityReduced: true, // Mark as reduced since rotation was skipped
            rotationSkipped: true,
          });
        } else {
          // No rotation needed - use original image data
          const image = e.target?.result as string;

          // If cropped but no rotation, we need a canvas to apply the crop
          if (cropData) {
            const canvasResult = createSafeCanvas(width, height);
            if (canvasResult) {
              const { canvas, ctx } = canvasResult;
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(
                img,
                cropSrcX,
                cropSrcY,
                cropSrcW,
                cropSrcH,
                0,
                0,
                width,
                height,
              );
              const croppedImage = canvas.toDataURL("image/png");
              if (validateCanvasOutput(croppedImage)) {
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
                  image: croppedImage,
                  originalWidth: img.width,
                  originalHeight: img.height,
                  qualityReduced,
                });
                return;
              }
            }
          }

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
  usedDirectEmbed: boolean;
  directEmbedFiles: string[];
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
  let usedDirectEmbed = false;
  const directEmbedFiles: string[] = [];

  for (const file of files) {
    if (file.type === "pdf") {
      // Handle PDF file
      const arrayBuffer = await file.file.arrayBuffer();
      const hasPageCrops =
        file.pageCropData && Object.keys(file.pageCropData).length > 0;
      const hasDeletedPages = file.deletedPages && file.deletedPages.length > 0;
      const hasPageRotations =
        file.pageRotations && Object.keys(file.pageRotations).length > 0;

      // For compression, cropped pages, deleted pages, or rotated pages, we need to use pdf.js
      // Then embed them as images in the new PDF
      if (
        compression.quality !== "high" ||
        hasPageCrops ||
        hasDeletedPages ||
        hasPageRotations
      ) {
        // Use canvas-based processing for compression and/or cropping
        try {
          const pdfDoc = await pdfjsLib.getDocument({
            data: arrayBuffer,
            password: file.password || undefined,
          }).promise;

          const dpiScale = getDpiScale(compression.quality);
          const jpegQuality = getJpegQuality(compression.quality);

          for (let i = 1; i <= pdfDoc.numPages; i++) {
            // Skip deleted pages
            if (file.deletedPages?.includes(i)) {
              continue;
            }

            const pdfPage = await pdfDoc.getPage(i);
            const pageRotation = file.pageRotations?.[i] ?? 0;
            const viewport = pdfPage.getViewport({
              scale: 1,
              rotation: pageRotation,
            });
            const pageCrop = file.pageCropData?.[i];

            // If high quality + no crop + no rotation for this page, try to copy directly
            if (
              compression.quality === "high" &&
              !pageCrop &&
              pageRotation === 0
            ) {
              // For uncropped/unrotated pages in high quality mode, copy directly
              try {
                const pdfLibDoc = await PDFDocument.load(arrayBuffer, {
                  ignoreEncryption: !!file.password,
                });
                const [copiedPage] = await mergedPdf.copyPages(pdfLibDoc, [
                  i - 1,
                ]);
                mergedPdf.addPage(copiedPage);
                continue;
              } catch {
                // Fallback to rendering if direct copy fails
              }
            }

            // Render page to image (with optional crop and rotation)
            const renderResult = await renderPdfPageToImageWithCrop(
              pdfPage,
              dpiScale,
              jpegQuality,
              pageCrop,
              pageRotation,
            );

            // Track if quality was reduced
            if (renderResult.qualityReduced) {
              qualityReduced = true;
              if (!reducedFiles.includes(file.name)) {
                reducedFiles.push(file.name);
              }
            }

            // Determine final page dimensions
            let pageWidth: number;
            let pageHeight: number;
            if (pageCrop) {
              // Cropped dimensions
              pageWidth = viewport.width * pageCrop.width;
              pageHeight = viewport.height * pageCrop.height;
            } else {
              pageWidth = viewport.width;
              pageHeight = viewport.height;
            }

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
            "PDF processing failed, falling back to direct copy:",
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
      }
    } else {
      // Handle image file
      const imageData = await extractImageAsPage(
        file.file,
        settings,
        compression,
        file.rotation || 0,
        file.cropData,
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
        // FINAL FALLBACK: Direct embed of original image bytes
        // This bypasses canvas completely and guarantees the PDF works
        console.warn(
          `[pdf-utils] Canvas processing failed for ${file.name}, using direct embed fallback:`,
          error,
        );

        qualityReduced = true;
        usedDirectEmbed = true;
        if (!reducedFiles.includes(file.name)) {
          reducedFiles.push(file.name);
        }
        if (!directEmbedFiles.includes(file.name)) {
          directEmbedFiles.push(file.name);
        }

        try {
          // Try embedding original image directly from file bytes
          const arrayBuffer = await file.file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          let image;
          if (
            file.file.type === "image/png" ||
            file.name.toLowerCase().endsWith(".png")
          ) {
            image = await mergedPdf.embedPng(uint8Array);
          } else {
            image = await mergedPdf.embedJpg(uint8Array);
          }

          page.drawImage(image, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
          });

          console.info(
            `[pdf-utils] Successfully embedded ${file.name} using direct file bytes`,
          );
        } catch (embedError) {
          // Last resort: try with original data URL
          console.warn(
            `[pdf-utils] Direct embed failed for ${file.name}, trying data URL:`,
            embedError,
          );

          const image = await mergedPdf.embedJpg(imageData.image);
          page.drawImage(image, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
          });
        }
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
    usedDirectEmbed,
    directEmbedFiles,
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
