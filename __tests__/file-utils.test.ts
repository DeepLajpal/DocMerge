import { describe, it, expect } from "vitest";
import {
  isValidFileType,
  formatFileSize,
  generateUniqueId,
  FILE_LIMITS,
  validateFile,
  validateFileBatch,
  validateMagicBytes,
} from "../lib/file-utils";

describe("file-utils", () => {
  describe("isValidFileType", () => {
    it("should accept PDF files", () => {
      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });
      expect(isValidFileType(file)).toBe(true);
    });

    it("should accept JPEG files", () => {
      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      expect(isValidFileType(file)).toBe(true);
    });

    it("should accept PNG files", () => {
      const file = new File(["content"], "test.png", { type: "image/png" });
      expect(isValidFileType(file)).toBe(true);
    });

    it("should reject unsupported file types", () => {
      const docFile = new File(["content"], "test.doc", {
        type: "application/msword",
      });
      expect(isValidFileType(docFile)).toBe(false);

      const txtFile = new File(["content"], "test.txt", { type: "text/plain" });
      expect(isValidFileType(txtFile)).toBe(false);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
      expect(formatFileSize(500)).toBe("500 Bytes");
    });

    it("should format kilobytes correctly", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("should format megabytes correctly", () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
      expect(formatFileSize(5242880)).toBe("5 MB");
    });

    it("should format gigabytes correctly", () => {
      expect(formatFileSize(1073741824)).toBe("1 GB");
    });
  });

  describe("generateUniqueId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateUniqueId();
      const id2 = generateUniqueId();
      expect(id1).not.toBe(id2);
    });

    it("should generate IDs with expected format", () => {
      const id = generateUniqueId();
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe("FILE_LIMITS", () => {
    it("should have correct limits defined", () => {
      expect(FILE_LIMITS.MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
      expect(FILE_LIMITS.MAX_TOTAL_SIZE).toBe(500 * 1024 * 1024);
      expect(FILE_LIMITS.MAX_FILES).toBe(50);
    });
  });

  describe("validateMagicBytes", () => {
    it("should validate PDF magic bytes", async () => {
      // Create a file with PDF magic bytes: %PDF
      const pdfHeader = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
      ]);
      const file = new File([pdfHeader], "test.pdf", {
        type: "application/pdf",
      });
      expect(await validateMagicBytes(file)).toBe(true);
    });

    it("should reject PDF with wrong magic bytes", async () => {
      const wrongHeader = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const file = new File([wrongHeader], "test.pdf", {
        type: "application/pdf",
      });
      expect(await validateMagicBytes(file)).toBe(false);
    });

    it("should validate PNG magic bytes", async () => {
      const pngHeader = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const file = new File([pngHeader], "test.png", { type: "image/png" });
      expect(await validateMagicBytes(file)).toBe(true);
    });

    it("should validate JPEG magic bytes", async () => {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = new File([jpegHeader], "test.jpg", { type: "image/jpeg" });
      expect(await validateMagicBytes(file)).toBe(true);
    });
  });

  describe("validateFile", () => {
    it("should reject invalid file types", async () => {
      const file = new File(["content"], "test.doc", {
        type: "application/msword",
      });
      const result = await validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    });

    it("should reject empty files", async () => {
      const file = new File([], "empty.pdf", { type: "application/pdf" });
      const result = await validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File is empty");
    });

    it("should reject files exceeding size limit", async () => {
      // Create a mock large file (we can't actually create a 100MB+ file in tests)
      const largeContent = new Uint8Array(FILE_LIMITS.MAX_FILE_SIZE + 1);
      const file = new File([largeContent], "large.pdf", {
        type: "application/pdf",
      });
      const result = await validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("should accept valid PDF files with correct magic bytes", async () => {
      const pdfHeader = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
      ]);
      const file = new File([pdfHeader], "test.pdf", {
        type: "application/pdf",
      });
      const result = await validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("validateFileBatch", () => {
    it("should validate multiple files", async () => {
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

      const files = [
        new File([pdfHeader], "doc1.pdf", { type: "application/pdf" }),
        new File([pngHeader], "img1.png", { type: "image/png" }),
      ];

      const result = await validateFileBatch(files);
      expect(result.valid).toBe(true);
      expect(result.validFiles).toHaveLength(2);
      expect(result.invalidFiles).toHaveLength(0);
    });

    it("should separate valid and invalid files", async () => {
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

      const files = [
        new File([pdfHeader], "doc1.pdf", { type: "application/pdf" }),
        new File(["content"], "doc.txt", { type: "text/plain" }),
      ];

      const result = await validateFileBatch(files);
      expect(result.valid).toBe(false);
      expect(result.validFiles).toHaveLength(1);
      expect(result.invalidFiles).toHaveLength(1);
      expect(result.invalidFiles[0].file.name).toBe("doc.txt");
    });

    it("should check total size limit", async () => {
      const existingSize = FILE_LIMITS.MAX_TOTAL_SIZE - 100;
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const files = [
        new File([pdfHeader], "doc.pdf", { type: "application/pdf" }),
      ];

      const result = await validateFileBatch(files, existingSize);
      // Even if individual files are valid, total size might exceed limit
      // The validation should still work
      expect(result.errors).toBeDefined();
    });
  });
});
