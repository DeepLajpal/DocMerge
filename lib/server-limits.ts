/**
 * Server-side processing limits and validation.
 * Ensures files meet Vercel free tier constraints before upload.
 */

import { CONFIG, bytesToMB, formatBytes, mbToBytes } from "./config";
import type { UploadedFile } from "./types";

export interface ServerLimitValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalSize: number;
  fileCount: number;
}

/**
 * Check if files can be processed server-side within Vercel free tier limits.
 */
export function checkServerLimits(
  files: UploadedFile[],
): ServerLimitValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if server processing is enabled
  if (!CONFIG.server.enabled) {
    return {
      valid: false,
      errors: ["Server processing is disabled"],
      warnings: [],
      totalSize: 0,
      fileCount: files.length,
    };
  }

  // Check file count
  if (files.length > CONFIG.server.maxFiles) {
    errors.push(
      `Too many files: ${files.length} (limit: ${CONFIG.server.maxFiles})`,
    );
  }

  // Calculate total size and check individual file sizes
  let totalSize = 0;
  const oversizedFiles: string[] = [];

  for (const file of files) {
    totalSize += file.size;
    const fileSizeMB = bytesToMB(file.size);

    if (fileSizeMB > CONFIG.server.maxFileSizeMB) {
      oversizedFiles.push(`${file.name} (${formatBytes(file.size)})`);
    }
  }

  if (oversizedFiles.length > 0) {
    errors.push(
      `Files too large for server: ${oversizedFiles.join(", ")} ` +
        `(limit: ${CONFIG.server.maxFileSizeMB}MB each)`,
    );
  }

  // Check total size
  const totalSizeMB = bytesToMB(totalSize);
  if (totalSizeMB > CONFIG.server.maxTotalSizeMB) {
    errors.push(
      `Total size ${formatBytes(totalSize)} exceeds server limit of ${CONFIG.server.maxTotalSizeMB}MB`,
    );
  }

  // Add warnings for files approaching limits
  if (totalSizeMB > CONFIG.server.maxTotalSizeMB * 0.8 && errors.length === 0) {
    warnings.push(
      `Total size (${formatBytes(totalSize)}) is approaching the server limit`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalSize,
    fileCount: files.length,
  };
}

/**
 * Get a summary of server limits for display to users.
 */
export function getServerLimitsSummary(): {
  maxTotalSize: string;
  maxFileSize: string;
  maxFiles: number;
  enabled: boolean;
} {
  return {
    maxTotalSize: `${CONFIG.server.maxTotalSizeMB}MB`,
    maxFileSize: `${CONFIG.server.maxFileSizeMB}MB`,
    maxFiles: CONFIG.server.maxFiles,
    enabled: CONFIG.server.enabled,
  };
}

/**
 * Quick check if server processing is available for the given files.
 * Returns true only if all limits are satisfied.
 */
export function canUseServerProcessing(files: UploadedFile[]): boolean {
  return checkServerLimits(files).valid;
}
