export interface CropData {
  x: number;      // Left offset as percentage (0–1)
  y: number;      // Top offset as percentage (0–1)
  width: number;  // Width as percentage (0–1)
  height: number; // Height as percentage (0–1)
}

// Per-page crop data for PDFs (1-indexed page numbers)
export interface PageCropData {
  [pageNumber: number]: CropData;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: "pdf" | "image";
  pages?: number;
  isPasswordProtected?: boolean;
  password?: string;
  file: File;
  order: number;
  thumbnail?: string;
  rotation?: number;
  cropData?: CropData;
  pageCropData?: PageCropData;  // Per-page crop data for PDFs
}

export interface OutputSettings {
  pageSize: "A4" | "Letter" | "Legal" | "Custom";
  customWidth?: number;
  customHeight?: number;
  orientation: "portrait" | "landscape";
  filename: string;
}

export interface CompressionSettings {
  targetSize: number;
  targetUnit: "KB" | "MB";
  quality: "high" | "balanced" | "small";
  processingMode: "browser" | "server";
}

export interface MergeResult {
  pages: number;
  finalSize: number;
  qualityReduced?: boolean;
  qualityWarningMessage?: string;
  downloadUrl?: string;
  downloadFilename?: string;
}

export interface MergeState {
  files: UploadedFile[];
  outputSettings: OutputSettings;
  compressionSettings: CompressionSettings;
  mergeResult?: MergeResult;
  isLoading: boolean;
  error?: string;
  qualityWarning?: string;
}
