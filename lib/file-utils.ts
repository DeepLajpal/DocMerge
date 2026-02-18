// File validation constants
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB per file
  MAX_TOTAL_SIZE: 500 * 1024 * 1024, // 500MB total
  MAX_FILES: 50,
} as const;

// Magic bytes for file type validation
const MAGIC_BYTES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4e, 0x47], // PNG header
  jpeg: [0xff, 0xd8, 0xff], // JPEG header
} as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface BatchValidationResult {
  valid: boolean;
  errors: string[];
  validFiles: File[];
  invalidFiles: Array<{ file: File; error: string }>;
}

/**
 * Validates a file's magic bytes to ensure it matches its claimed type
 */
export async function validateMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (file.type === "application/pdf") {
      return MAGIC_BYTES.pdf.every((byte, i) => bytes[i] === byte);
    }

    if (file.type === "image/png") {
      return MAGIC_BYTES.png.every((byte, i) => bytes[i] === byte);
    }

    if (file.type === "image/jpeg" || file.type === "image/jpg") {
      return MAGIC_BYTES.jpeg.every((byte, i) => bytes[i] === byte);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Comprehensive file validation with detailed error messages
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  // Check MIME type
  if (!isValidFileType(file)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type || "unknown"}. Supported: PDF, JPEG, PNG`,
    };
  }

  // Check file size
  if (file.size > FILE_LIMITS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${formatFileSize(file.size)}. Maximum: ${formatFileSize(FILE_LIMITS.MAX_FILE_SIZE)}`,
    };
  }

  // Check file is not empty
  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  // Validate magic bytes for security
  const validMagic = await validateMagicBytes(file);
  if (!validMagic) {
    return {
      valid: false,
      error:
        "File content does not match its type. The file may be corrupted or misnamed.",
    };
  }

  return { valid: true };
}

/**
 * Validates a batch of files against size and count limits
 */
export async function validateFileBatch(
  files: File[],
  existingFilesSize: number = 0,
): Promise<BatchValidationResult> {
  const errors: string[] = [];
  const validFiles: File[] = [];
  const invalidFiles: Array<{ file: File; error: string }> = [];

  // Check file count
  if (files.length > FILE_LIMITS.MAX_FILES) {
    errors.push(`Too many files. Maximum: ${FILE_LIMITS.MAX_FILES}`);
  }

  // Calculate total size
  const totalSize = files.reduce((sum, f) => sum + f.size, existingFilesSize);
  if (totalSize > FILE_LIMITS.MAX_TOTAL_SIZE) {
    errors.push(
      `Total size exceeds limit: ${formatFileSize(totalSize)}. Maximum: ${formatFileSize(FILE_LIMITS.MAX_TOTAL_SIZE)}`,
    );
  }

  // Validate each file
  for (const file of files) {
    const result = await validateFile(file);
    if (result.valid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({ file, error: result.error || "Unknown error" });
    }
  }

  return {
    valid: invalidFiles.length === 0 && errors.length === 0,
    errors,
    validFiles,
    invalidFiles,
  };
}

export function isValidFileType(file: File): boolean {
  const validTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];
  return validTypes.includes(file.type);
}

export function getFileIcon(type: string): string {
  if (type === "pdf") return "FileText";
  if (type === "image") return "Image";
  return "File";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
