export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: 'pdf' | 'image';
  pages?: number;
  isPasswordProtected?: boolean;
  password?: string;
  file: File;
  order: number;
}

export interface OutputSettings {
  pageSize: 'A4' | 'Letter' | 'Legal' | 'Custom';
  customWidth?: number;
  customHeight?: number;
  orientation: 'portrait' | 'landscape';
  filename: string;
}

export interface CompressionSettings {
  targetSize: number;
  targetUnit: 'KB' | 'MB';
  quality: 'high' | 'balanced' | 'small';
}

export interface MergeResult {
  pages: number;
  finalSize: number;
}

export interface MergeState {
  files: UploadedFile[];
  outputSettings: OutputSettings;
  compressionSettings: CompressionSettings;
  mergeResult?: MergeResult;
  isLoading: boolean;
  error?: string;
}
