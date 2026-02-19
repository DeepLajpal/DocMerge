import { describe, it, expect, beforeEach } from "vitest";
import { useMergeStore } from "../lib/store";

describe("useMergeStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    useMergeStore.setState({
      files: [],
      outputSettings: {
        pageSize: "A4",
        orientation: "portrait",
        filename: "merged-document",
      },
      compressionSettings: {
        targetSize: 5,
        targetUnit: "MB",
        quality: "balanced",
        processingMode: "browser",
      },
      isLoading: false,
      error: undefined,
      mergeResult: undefined,
    });
  });

  describe("addFiles", () => {
    it("should add files to the store", () => {
      const store = useMergeStore.getState();
      const mockFiles = [
        new File(["content1"], "test1.pdf", { type: "application/pdf" }),
        new File(["content2"], "test2.pdf", { type: "application/pdf" }),
      ];

      store.addFiles(mockFiles);

      const state = useMergeStore.getState();
      expect(state.files).toHaveLength(2);
      expect(state.files[0].name).toBe("test1.pdf");
      expect(state.files[1].name).toBe("test2.pdf");
    });

    it("should assign sequential order to files", () => {
      const store = useMergeStore.getState();
      const mockFiles = [
        new File(["content1"], "test1.pdf", { type: "application/pdf" }),
        new File(["content2"], "test2.pdf", { type: "application/pdf" }),
      ];

      store.addFiles(mockFiles);

      const state = useMergeStore.getState();
      expect(state.files[0].order).toBe(0);
      expect(state.files[1].order).toBe(1);
    });

    it("should continue order when adding more files", () => {
      const store = useMergeStore.getState();

      store.addFiles([
        new File(["1"], "first.pdf", { type: "application/pdf" }),
      ]);
      store.addFiles([
        new File(["2"], "second.pdf", { type: "application/pdf" }),
      ]);

      const state = useMergeStore.getState();
      expect(state.files).toHaveLength(2);
      expect(state.files[1].order).toBe(1);
    });
  });

  describe("removeFile", () => {
    it("should remove a file by id", () => {
      const store = useMergeStore.getState();
      store.addFiles([
        new File(["content"], "test.pdf", { type: "application/pdf" }),
      ]);

      const state = useMergeStore.getState();
      const fileId = state.files[0].id;

      store.removeFile(fileId);

      expect(useMergeStore.getState().files).toHaveLength(0);
    });

    it("should not affect other files when removing one", () => {
      const store = useMergeStore.getState();
      store.addFiles([
        new File(["1"], "keep.pdf", { type: "application/pdf" }),
        new File(["2"], "remove.pdf", { type: "application/pdf" }),
        new File(["3"], "also-keep.pdf", { type: "application/pdf" }),
      ]);

      const state = useMergeStore.getState();
      const removeId = state.files[1].id;

      store.removeFile(removeId);

      const newState = useMergeStore.getState();
      expect(newState.files).toHaveLength(2);
      expect(newState.files.map((f) => f.name)).toEqual([
        "keep.pdf",
        "also-keep.pdf",
      ]);
    });
  });

  describe("reorderFiles", () => {
    it("should reorder files", () => {
      const store = useMergeStore.getState();
      store.addFiles([
        new File(["1"], "first.pdf", { type: "application/pdf" }),
        new File(["2"], "second.pdf", { type: "application/pdf" }),
      ]);

      const state = useMergeStore.getState();
      const reordered = [...state.files].reverse();

      store.reorderFiles(reordered);

      const newState = useMergeStore.getState();
      expect(newState.files[0].name).toBe("second.pdf");
      expect(newState.files[1].name).toBe("first.pdf");
    });
  });

  describe("updatePassword", () => {
    it("should update password for a file", () => {
      const store = useMergeStore.getState();
      store.addFiles([
        new File(["content"], "protected.pdf", { type: "application/pdf" }),
      ]);

      const state = useMergeStore.getState();
      const fileId = state.files[0].id;

      store.updatePassword(fileId, "secret123");

      const newState = useMergeStore.getState();
      expect(newState.files[0].password).toBe("secret123");
    });
  });

  describe("updateOutputSettings", () => {
    it("should update output settings partially", () => {
      const store = useMergeStore.getState();

      store.updateOutputSettings({ pageSize: "Letter" });

      const state = useMergeStore.getState();
      expect(state.outputSettings.pageSize).toBe("Letter");
      expect(state.outputSettings.orientation).toBe("portrait");
      expect(state.outputSettings.filename).toBe("merged-document");
    });

    it("should update multiple settings at once", () => {
      const store = useMergeStore.getState();

      store.updateOutputSettings({
        pageSize: "Legal",
        orientation: "landscape",
        filename: "my-document",
      });

      const state = useMergeStore.getState();
      expect(state.outputSettings).toEqual({
        pageSize: "Legal",
        orientation: "landscape",
        filename: "my-document",
      });
    });
  });

  describe("updateCompressionSettings", () => {
    it("should update compression settings", () => {
      const store = useMergeStore.getState();

      store.updateCompressionSettings({ quality: "high" });

      const state = useMergeStore.getState();
      expect(state.compressionSettings.quality).toBe("high");
    });
  });

  describe("setLoading", () => {
    it("should set loading state", () => {
      const store = useMergeStore.getState();

      store.setLoading(true);
      expect(useMergeStore.getState().isLoading).toBe(true);

      store.setLoading(false);
      expect(useMergeStore.getState().isLoading).toBe(false);
    });
  });

  describe("setError", () => {
    it("should set error message", () => {
      const store = useMergeStore.getState();

      store.setError("Something went wrong");
      expect(useMergeStore.getState().error).toBe("Something went wrong");

      store.setError(undefined);
      expect(useMergeStore.getState().error).toBeUndefined();
    });
  });

  describe("resetApp", () => {
    it("should reset all state to defaults", () => {
      const store = useMergeStore.getState();

      // Modify state
      store.addFiles([
        new File(["content"], "test.pdf", { type: "application/pdf" }),
      ]);
      store.updateOutputSettings({ filename: "custom-doc" });
      store.setLoading(true);
      store.setError("An error");

      // Reset
      store.resetApp();

      const state = useMergeStore.getState();
      expect(state.files).toHaveLength(0);
      expect(state.outputSettings.filename).toBe("merged-document");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeUndefined();
    });
  });
});
