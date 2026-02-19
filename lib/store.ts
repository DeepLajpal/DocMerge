"use client";

import { create } from "zustand";
import {
  UploadedFile,
  OutputSettings,
  CompressionSettings,
  MergeResult,
  MergeState,
  CropData,
  PageCropData,
} from "./types";

interface MergeStore extends MergeState {
  addFiles: (newFiles: File[]) => void;
  removeFile: (id: string) => void;
  reorderFiles: (files: UploadedFile[]) => void;
  updatePassword: (id: string, password: string) => void;
  updateFileProtection: (id: string, isPasswordProtected: boolean) => void;
  updateFileRotation: (id: string, rotation: number) => void;
  updateFileCrop: (id: string, cropData: CropData | undefined) => void;
  updatePdfPageCrop: (
    id: string,
    pageNumber: number,
    cropData: CropData | undefined,
  ) => void;
  clearPdfPageCrops: (id: string) => void;
  deletePdfPage: (id: string, pageNumber: number) => void;
  restorePdfPage: (id: string, pageNumber: number) => void;
  clearDeletedPages: (id: string) => void;
  updatePdfPageRotation: (
    id: string,
    pageNumber: number,
    rotation: number,
  ) => void;
  clearPdfPageRotations: (id: string) => void;
  updateOutputSettings: (settings: Partial<OutputSettings>) => void;
  updateCompressionSettings: (settings: Partial<CompressionSettings>) => void;
  setLoading: (loading: boolean) => void;
  setMergeResult: (result: MergeResult) => void;
  setError: (error: string | undefined) => void;
  setQualityWarning: (warning: string | undefined) => void;
  resetApp: () => void;
  goBackToConversion: () => void;
}

const defaultOutputSettings: OutputSettings = {
  pageSize: "A4",
  orientation: "portrait",
  filename: "merged-document",
};

const defaultCompressionSettings: CompressionSettings = {
  targetSize: 5,
  targetUnit: "MB",
  quality: "balanced",
  processingMode: "browser",
};

export const useMergeStore = create<MergeStore>((set) => ({
  files: [],
  outputSettings: defaultOutputSettings,
  compressionSettings: defaultCompressionSettings,
  isLoading: false,
  error: undefined,
  qualityWarning: undefined,

  addFiles: (newFiles: File[]) =>
    set((state) => {
      const maxOrder =
        state.files.length > 0
          ? Math.max(...state.files.map((f) => f.order))
          : -1;
      const addedFiles = newFiles.map(
        (file, index): UploadedFile => ({
          id: `${Date.now()}-${index}`,
          name: file.name,
          size: file.size,
          type: file.name.endsWith(".pdf") ? "pdf" : "image",
          file,
          order: maxOrder + 1 + index,
        }),
      );
      return { files: [...state.files, ...addedFiles] };
    }),

  removeFile: (id: string) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
    })),

  reorderFiles: (files: UploadedFile[]) =>
    set(() => ({
      files,
    })),

  updatePassword: (id: string, password: string) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, password } : f)),
    })),

  updateFileProtection: (id: string, isPasswordProtected: boolean) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, isPasswordProtected } : f,
      ),
    })),

  updateFileRotation: (id: string, rotation: number) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, rotation } : f)),
    })),

  updateFileCrop: (id: string, cropData: CropData | undefined) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, cropData } : f)),
    })),

  updatePdfPageCrop: (
    id: string,
    pageNumber: number,
    cropData: CropData | undefined,
  ) =>
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f;
        const currentPageCrops = f.pageCropData || {};
        if (cropData) {
          return {
            ...f,
            pageCropData: { ...currentPageCrops, [pageNumber]: cropData },
          };
        } else {
          // Remove crop for this page
          const { [pageNumber]: removed, ...rest } = currentPageCrops;
          return {
            ...f,
            pageCropData: Object.keys(rest).length > 0 ? rest : undefined,
          };
        }
      }),
    })),

  clearPdfPageCrops: (id: string) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, pageCropData: undefined } : f,
      ),
    })),

  deletePdfPage: (id: string, pageNumber: number) =>
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f;
        const deletedPages = f.deletedPages || [];
        if (deletedPages.includes(pageNumber)) return f;
        return {
          ...f,
          deletedPages: [...deletedPages, pageNumber].sort((a, b) => a - b),
        };
      }),
    })),

  restorePdfPage: (id: string, pageNumber: number) =>
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f;
        const deletedPages = f.deletedPages || [];
        const newDeletedPages = deletedPages.filter((p) => p !== pageNumber);
        return {
          ...f,
          deletedPages:
            newDeletedPages.length > 0 ? newDeletedPages : undefined,
        };
      }),
    })),

  clearDeletedPages: (id: string) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, deletedPages: undefined } : f,
      ),
    })),

  updatePdfPageRotation: (id: string, pageNumber: number, rotation: number) =>
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f;
        const pageRotations = f.pageRotations || {};
        if (rotation === 0) {
          const { [pageNumber]: removed, ...rest } = pageRotations;
          return {
            ...f,
            pageRotations: Object.keys(rest).length > 0 ? rest : undefined,
          };
        }
        return {
          ...f,
          pageRotations: { ...pageRotations, [pageNumber]: rotation },
        };
      }),
    })),

  clearPdfPageRotations: (id: string) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, pageRotations: undefined } : f,
      ),
    })),

  updateOutputSettings: (settings: Partial<OutputSettings>) =>
    set((state) => ({
      outputSettings: { ...state.outputSettings, ...settings },
    })),

  updateCompressionSettings: (settings: Partial<CompressionSettings>) =>
    set((state) => ({
      compressionSettings: { ...state.compressionSettings, ...settings },
    })),

  setLoading: (loading: boolean) =>
    set(() => ({
      isLoading: loading,
    })),

  setMergeResult: (result: MergeResult) =>
    set(() => ({
      mergeResult: result,
    })),

  setError: (error: string | undefined) =>
    set(() => ({
      error,
    })),

  setQualityWarning: (warning: string | undefined) =>
    set(() => ({
      qualityWarning: warning,
    })),

  resetApp: () =>
    set((state) => {
      // Revoke the download URL to free memory
      if (state.mergeResult?.downloadUrl) {
        URL.revokeObjectURL(state.mergeResult.downloadUrl);
      }
      return {
        files: [],
        outputSettings: defaultOutputSettings,
        compressionSettings: defaultCompressionSettings,
        mergeResult: undefined,
        isLoading: false,
        error: undefined,
        qualityWarning: undefined,
      };
    }),

  goBackToConversion: () =>
    set((state) => {
      // Revoke the download URL to free memory
      if (state.mergeResult?.downloadUrl) {
        URL.revokeObjectURL(state.mergeResult.downloadUrl);
      }
      return {
        mergeResult: undefined,
        isLoading: false,
        error: undefined,
        qualityWarning: undefined,
      };
    }),
}));
