import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MergeButton } from "../components/doc-merge/merge-button";
import { useMergeStore } from "../lib/store";
import type { UploadedFile } from "../lib/types";

// Mock the PDF utils to avoid actual PDF processing in tests
vi.mock("../lib/pdf-utils", () => ({
  mergePDFsAndImages: vi.fn().mockResolvedValue({
    pdfBytes: new Uint8Array([1, 2, 3]),
    qualityReduced: false,
    reducedFiles: [],
  }),
}));

describe("MergeButton", () => {
  beforeEach(() => {
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
      },
      isLoading: false,
      error: undefined,
      qualityWarning: undefined,
      mergeResult: undefined,
    });
  });

  it("should render the merge button", () => {
    render(<MergeButton />);
    expect(screen.getByRole("button", { name: /merge/i })).toBeInTheDocument();
  });

  it("should be disabled when no files are uploaded", () => {
    render(<MergeButton />);
    const button = screen.getByRole("button", { name: /merge/i });
    expect(button).toBeDisabled();
  });

  it("should show message when no files are uploaded", () => {
    render(<MergeButton />);
    expect(
      screen.getByText(/upload at least one file to merge/i),
    ).toBeInTheDocument();
  });

  it("should be enabled when files are uploaded", () => {
    const mockFile: UploadedFile = {
      id: "1",
      name: "test.pdf",
      size: 1024,
      type: "pdf",
      file: new File(["content"], "test.pdf", { type: "application/pdf" }),
      pages: 1,
      order: 0,
    };

    useMergeStore.setState({ files: [mockFile] });

    render(<MergeButton />);
    const button = screen.getByRole("button", { name: /merge/i });
    expect(button).not.toBeDisabled();
  });

  it("should be disabled when password-protected files need password", () => {
    const mockFile: UploadedFile = {
      id: "1",
      name: "protected.pdf",
      size: 1024,
      type: "pdf",
      file: new File(["content"], "protected.pdf", { type: "application/pdf" }),
      pages: 1,
      order: 0,
      isPasswordProtected: true,
      password: undefined,
    };

    useMergeStore.setState({ files: [mockFile] });

    render(<MergeButton />);

    const button = screen.getByRole("button", { name: /merge/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/password-protected/i)).toBeInTheDocument();
  });

  it("should be enabled when password-protected files have password", () => {
    const mockFile: UploadedFile = {
      id: "1",
      name: "protected.pdf",
      size: 1024,
      type: "pdf",
      file: new File(["content"], "protected.pdf", { type: "application/pdf" }),
      pages: 1,
      order: 0,
      isPasswordProtected: true,
      password: "secret123",
    };

    useMergeStore.setState({ files: [mockFile] });

    render(<MergeButton />);

    const button = screen.getByRole("button", { name: /merge/i });
    expect(button).not.toBeDisabled();
  });

  it("should show loading spinner when merging", () => {
    const mockFile: UploadedFile = {
      id: "1",
      name: "test.pdf",
      size: 1024,
      type: "pdf",
      file: new File(["content"], "test.pdf", { type: "application/pdf" }),
      pages: 1,
      order: 0,
    };

    useMergeStore.setState({
      files: [mockFile],
      isLoading: true,
    });

    render(<MergeButton />);

    expect(screen.getByText(/merging/i)).toBeInTheDocument();
  });

  it("should display error when present", () => {
    useMergeStore.setState({
      files: [],
      error: "Test error message",
    });

    render(<MergeButton />);

    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("should trigger merge when clicked with files", async () => {
    const mockFile: UploadedFile = {
      id: "1",
      name: "test.pdf",
      size: 1024,
      type: "pdf",
      file: new File(["content"], "test.pdf", { type: "application/pdf" }),
      pages: 1,
      order: 0,
    };

    useMergeStore.setState({ files: [mockFile] });

    render(<MergeButton />);

    const button = screen.getByRole("button", { name: /merge/i });
    fireEvent.click(button);

    // Should start loading
    expect(useMergeStore.getState().isLoading).toBe(true);
  });
});
