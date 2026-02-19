/**
 * Server-side PDF merge endpoint.
 * Uses sharp for image processing (no Canvas limitations).
 * Subject to Vercel free tier limits (configured via env vars).
 */

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { CONFIG, formatBytes, bytesToMB } from "@/lib/config";

// Vercel configuration
export const runtime = "nodejs";
export const maxDuration = 10; // Vercel free tier limit

interface FileInput {
  name: string;
  type: "pdf" | "image";
  data: string; // Base64 encoded
  rotation?: number;
  password?: string;
  cropData?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pageCropData?: {
    [pageNumber: number]: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  deletedPages?: number[];
  pageRotations?: {
    [pageNumber: number]: number;
  };
}

interface MergeRequest {
  files: FileInput[];
  settings: {
    pageSize: "A4" | "Letter" | "Legal" | "Custom";
    orientation: "portrait" | "landscape";
    customWidth?: number;
    customHeight?: number;
  };
  compression: {
    quality: "high" | "balanced" | "small";
  };
}

// Page dimensions in points (1/72 inch)
const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
} as const;

function getPageDimensions(
  pageSize: string,
  orientation: string,
  customWidth?: number,
  customHeight?: number,
): { width: number; height: number } {
  let dims =
    pageSize === "Custom" && customWidth && customHeight
      ? { width: customWidth, height: customHeight }
      : PAGE_SIZES[pageSize as keyof typeof PAGE_SIZES] || PAGE_SIZES.A4;

  // Swap for landscape
  if (orientation === "landscape") {
    dims = { width: dims.height, height: dims.width };
  }

  return dims;
}

function getJpegQuality(quality: string): number {
  switch (quality) {
    case "high":
      return 95;
    case "balanced":
      return 85;
    case "small":
      return 75;
    default:
      return 85;
  }
}

function getResizeScale(quality: string): number {
  switch (quality) {
    case "high":
      return 1;
    case "balanced":
      return 0.85;
    case "small":
      return 0.7;
    default:
      return 0.85;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if server processing is enabled
    if (!CONFIG.server.enabled) {
      return NextResponse.json(
        { error: "Server processing is disabled" },
        { status: 503 },
      );
    }

    // Parse request body
    const body: MergeRequest = await request.json();
    const { files, settings, compression } = body;

    // Validate request
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Check file count limit
    if (files.length > CONFIG.server.maxFiles) {
      return NextResponse.json(
        {
          error: `Too many files: ${files.length} (limit: ${CONFIG.server.maxFiles})`,
        },
        { status: 400 },
      );
    }

    // Validate and calculate total size
    let totalSize = 0;
    for (const file of files) {
      const fileSize = Buffer.from(file.data, "base64").length;
      totalSize += fileSize;

      if (bytesToMB(fileSize) > CONFIG.server.maxFileSizeMB) {
        return NextResponse.json(
          {
            error: `File "${file.name}" exceeds size limit of ${CONFIG.server.maxFileSizeMB}MB`,
          },
          { status: 400 },
        );
      }
    }

    if (bytesToMB(totalSize) > CONFIG.server.maxTotalSizeMB) {
      return NextResponse.json(
        {
          error: `Total size ${formatBytes(totalSize)} exceeds limit of ${CONFIG.server.maxTotalSizeMB}MB`,
        },
        { status: 400 },
      );
    }

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();
    const pageDims = getPageDimensions(
      settings.pageSize,
      settings.orientation,
      settings.customWidth,
      settings.customHeight,
    );

    const jpegQuality = getJpegQuality(compression.quality);
    const resizeScale = getResizeScale(compression.quality);

    for (const file of files) {
      const buffer = Buffer.from(file.data, "base64");

      if (file.type === "pdf") {
        // Handle PDF
        try {
          const sourcePdf = await PDFDocument.load(buffer, {
            ignoreEncryption: !!file.password,
          });

          // Get page indices, filtering out deleted pages
          let pageIndices = sourcePdf.getPageIndices();
          if (file.deletedPages && file.deletedPages.length > 0) {
            pageIndices = pageIndices.filter(
              (idx) => !file.deletedPages!.includes(idx + 1), // deletedPages is 1-indexed
            );
          }

          const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);

          // Apply page rotations if specified
          copiedPages.forEach((page, i) => {
            const originalPageNum = pageIndices[i] + 1; // Convert to 1-indexed
            const rotation = file.pageRotations?.[originalPageNum];
            if (rotation && rotation !== 0) {
              // pdf-lib rotation is cumulative, so set the absolute rotation
              const currentRotation = page.getRotation().angle;
              page.setRotation({
                type: "degrees",
                angle: currentRotation + rotation,
              } as any);
            }
            mergedPdf.addPage(page);
          });
        } catch (error: any) {
          console.error(`Failed to process PDF ${file.name}:`, error);
          return NextResponse.json(
            { error: `Failed to process PDF: ${file.name}` },
            { status: 500 },
          );
        }
      } else {
        // Handle image using sharp
        try {
          let image = sharp(buffer);
          const metadata = await image.metadata();

          if (!metadata.width || !metadata.height) {
            throw new Error("Could not read image dimensions");
          }

          let width = metadata.width;
          let height = metadata.height;

          // Apply crop if specified (before rotation/resize)
          if (
            file.cropData &&
            file.cropData.width > 0 &&
            file.cropData.height > 0
          ) {
            const extractLeft = Math.round(file.cropData.x * width);
            const extractTop = Math.round(file.cropData.y * height);
            const extractWidth = Math.round(file.cropData.width * width);
            const extractHeight = Math.round(file.cropData.height * height);
            image = image.extract({
              left: extractLeft,
              top: extractTop,
              width: extractWidth,
              height: extractHeight,
            });
            width = extractWidth;
            height = extractHeight;
          }

          // Apply rotation if specified
          if (file.rotation && file.rotation !== 0) {
            image = image.rotate(file.rotation);
            // Swap dimensions for 90/270 rotations
            if (file.rotation === 90 || file.rotation === 270) {
              [width, height] = [height, width];
            }
          }

          // Apply resize based on quality setting
          if (resizeScale < 1) {
            const newWidth = Math.round(width * resizeScale);
            const newHeight = Math.round(height * resizeScale);
            image = image.resize(newWidth, newHeight, {
              fit: "inside",
              withoutEnlargement: true,
            });
            width = newWidth;
            height = newHeight;
          }

          // Convert to JPEG with specified quality
          const imageBuffer = await image
            .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background
            .jpeg({ quality: jpegQuality })
            .toBuffer();

          // Create PDF page
          const page = mergedPdf.addPage([pageDims.width, pageDims.height]);

          // Calculate scaling to fit on page with margins
          const maxWidth = pageDims.width - 40;
          const maxHeight = pageDims.height - 40;
          let scaledWidth = width;
          let scaledHeight = height;

          const ratio = width / height;
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

          // Embed image
          const embeddedImage = await mergedPdf.embedJpg(imageBuffer);
          page.drawImage(embeddedImage, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
          });
        } catch (error: any) {
          console.error(`Failed to process image ${file.name}:`, error);
          return NextResponse.json(
            { error: `Failed to process image: ${file.name}` },
            { status: 500 },
          );
        }
      }

      // Check timeout
      if (Date.now() - startTime > CONFIG.server.timeoutMs) {
        return NextResponse.json(
          { error: "Processing timeout. Try with fewer or smaller files." },
          { status: 408 },
        );
      }
    }

    // Serialize PDF
    const pdfBytes = await mergedPdf.save();

    const processingTime = Date.now() - startTime;
    console.info(
      `[server-merge] Processed ${files.length} files in ${processingTime}ms, output: ${formatBytes(pdfBytes.length)}`,
    );

    // Return PDF bytes as base64
    return NextResponse.json({
      success: true,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      pages: mergedPdf.getPageCount(),
      size: pdfBytes.length,
      processingTime,
    });
  } catch (error: any) {
    console.error("[server-merge] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to merge files" },
      { status: 500 },
    );
  }
}
