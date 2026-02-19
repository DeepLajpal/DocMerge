import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getScaledDimensions,
  validateCanvasOutput,
  MAX_CANVAS_DIMENSION,
  MAX_CANVAS_AREA,
} from "../lib/canvas-utils";

describe("canvas-utils", () => {
  describe("getScaledDimensions", () => {
    it("should not scale dimensions within limits", () => {
      const result = getScaledDimensions(1920, 1080);
      expect(result.wasScaled).toBe(false);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.scaleFactor).toBe(1);
    });

    it("should scale down when width exceeds max dimension", () => {
      const result = getScaledDimensions(8000, 2000);
      expect(result.wasScaled).toBe(true);
      expect(result.width).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
      expect(result.height).toBeLessThan(2000);
      expect(result.scaleFactor).toBeLessThan(1);
    });

    it("should scale down when height exceeds max dimension", () => {
      const result = getScaledDimensions(2000, 8000);
      expect(result.wasScaled).toBe(true);
      expect(result.height).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
      expect(result.width).toBeLessThan(2000);
      expect(result.scaleFactor).toBeLessThan(1);
    });

    it("should scale down when area exceeds max", () => {
      // 5000 x 5000 = 25,000,000 pixels > 16,777,216
      const result = getScaledDimensions(5000, 5000);
      expect(result.wasScaled).toBe(true);
      expect(result.width * result.height).toBeLessThanOrEqual(MAX_CANVAS_AREA);
    });

    it("should maintain aspect ratio when scaling", () => {
      const originalRatio = 1920 / 1080;
      const result = getScaledDimensions(8000, 4500);
      const scaledRatio = result.width / result.height;
      // Allow small floating point differences
      expect(Math.abs(scaledRatio - 8000 / 4500)).toBeLessThan(0.01);
    });

    it("should handle edge case of exactly max dimensions", () => {
      const result = getScaledDimensions(
        MAX_CANVAS_DIMENSION,
        MAX_CANVAS_DIMENSION,
      );
      // Should scale because area exceeds max (4096*4096 = 16777216 which equals max area)
      // But due to the 95% safety margin, it should be scaled
      expect(result.width * result.height).toBeLessThanOrEqual(MAX_CANVAS_AREA);
    });

    it("should handle very small dimensions", () => {
      const result = getScaledDimensions(10, 10);
      expect(result.wasScaled).toBe(false);
      expect(result.width).toBe(10);
      expect(result.height).toBe(10);
    });

    it("should never return dimensions less than 1", () => {
      const result = getScaledDimensions(100000, 100000);
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe("validateCanvasOutput", () => {
    it("should return false for null", () => {
      expect(validateCanvasOutput(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateCanvasOutput(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(validateCanvasOutput("")).toBe(false);
    });

    it("should return false for empty data URL", () => {
      expect(validateCanvasOutput("data:,")).toBe(false);
    });

    it("should return false for minimal PNG data URL", () => {
      expect(validateCanvasOutput("data:image/png;base64,")).toBe(false);
    });

    it("should return false for minimal JPEG data URL", () => {
      expect(validateCanvasOutput("data:image/jpeg;base64,")).toBe(false);
    });

    it("should return false for data URL shorter than minimum length", () => {
      // Create a data URL that's valid format but too short
      const shortDataUrl = "data:image/png;base64,abc";
      expect(validateCanvasOutput(shortDataUrl)).toBe(false);
    });

    it("should return false for non-image data URL", () => {
      const textDataUrl = "text/plain;base64," + "a".repeat(2000);
      expect(validateCanvasOutput(textDataUrl)).toBe(false);
    });

    it("should return true for valid image data URL with sufficient length", () => {
      // Create a data URL that mimics a real image (1000+ chars)
      const validDataUrl = "data:image/jpeg;base64," + "a".repeat(1000);
      expect(validateCanvasOutput(validDataUrl)).toBe(true);
    });

    it("should return true for valid PNG data URL with sufficient length", () => {
      const validDataUrl = "data:image/png;base64," + "a".repeat(1000);
      expect(validateCanvasOutput(validDataUrl)).toBe(true);
    });

    it("should handle edge case of exactly minimum length", () => {
      // Exactly 1000 chars: "data:image/jpeg;base64," (23 chars) + 977 chars
      const exactMinDataUrl = "data:image/jpeg;base64," + "a".repeat(977);
      expect(validateCanvasOutput(exactMinDataUrl)).toBe(true);
    });
  });

  describe("mobile device simulation", () => {
    it("should handle typical phone camera image (4000x3000)", () => {
      const result = getScaledDimensions(4000, 3000);
      // 4000 * 3000 = 12,000,000 < 16,777,216, so no scaling needed
      expect(result.wasScaled).toBe(false);
    });

    it("should handle high-res phone camera image (4032x3024)", () => {
      const result = getScaledDimensions(4032, 3024);
      // 4032 * 3024 = 12,192,768 < 16,777,216, but width < 4096
      expect(result.wasScaled).toBe(false);
    });

    it("should handle pro camera image (6000x4000)", () => {
      const result = getScaledDimensions(6000, 4000);
      // 6000 * 4000 = 24,000,000 > 16,777,216, and 6000 > 4096
      expect(result.wasScaled).toBe(true);
      expect(result.width).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
      expect(result.width * result.height).toBeLessThanOrEqual(MAX_CANVAS_AREA);
    });

    it("should handle ultra-wide panorama image (10000x2000)", () => {
      const result = getScaledDimensions(10000, 2000);
      // 10000 > 4096
      expect(result.wasScaled).toBe(true);
      expect(result.width).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
    });
  });
});
