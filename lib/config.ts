/**
 * Centralized configuration loaded from environment variables.
 * All limits are configurable for Vercel free tier compatibility.
 */

export const CONFIG = {
  server: {
    /**
     * Whether server-side processing is enabled.
     * Set to false to completely disable the server option.
     */
    enabled: process.env.NEXT_PUBLIC_SERVER_ENABLED !== "false",

    /**
     * Maximum total size of all files combined (in MB).
     * Vercel free tier has 4.5MB request body limit.
     * Default: 4MB to leave room for overhead.
     */
    maxTotalSizeMB: parseFloat(
      process.env.NEXT_PUBLIC_SERVER_MAX_TOTAL_SIZE_MB || "4",
    ),

    /**
     * Maximum size per individual file (in MB).
     * Default: 2MB per file.
     */
    maxFileSizeMB: parseFloat(
      process.env.NEXT_PUBLIC_SERVER_MAX_FILE_SIZE_MB || "2",
    ),

    /**
     * Maximum number of files that can be processed server-side.
     * Default: 10 files.
     */
    maxFiles: parseInt(process.env.NEXT_PUBLIC_SERVER_MAX_FILES || "10", 10),

    /**
     * Server processing timeout in milliseconds.
     * Vercel free tier has 10 second limit.
     * Default: 9000ms to leave buffer.
     */
    timeoutMs: parseInt(
      process.env.NEXT_PUBLIC_SERVER_TIMEOUT_MS || "9000",
      10,
    ),
  },

  canvas: {
    /**
     * Maximum canvas dimension (width or height) in pixels.
     * Most mobile devices support up to 4096px.
     */
    maxDimension: parseInt(
      process.env.NEXT_PUBLIC_CANVAS_MAX_DIMENSION || "4096",
      10,
    ),

    /**
     * Maximum total pixels (width × height) for canvas.
     * 16 megapixels is a safe limit for most devices.
     */
    maxPixels: parseInt(
      process.env.NEXT_PUBLIC_CANVAS_MAX_PIXELS || "16777216",
      10,
    ),
  },
} as const;

/**
 * Convert bytes to megabytes
 */
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Convert megabytes to bytes
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
