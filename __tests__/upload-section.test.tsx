import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadSection } from "../components/doc-merge/upload-section";
import { useMergeStore } from "../lib/store";

describe("UploadSection", () => {
  beforeEach(() => {
    // Reset store before each test
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
    });
  });

  it("should render the upload section", () => {
    render(<UploadSection />);

    expect(screen.getByText("Upload your files")).toBeInTheDocument();
    expect(screen.getByText("Select Files")).toBeInTheDocument();
    expect(
      screen.getByText(/Supported formats: PDF, JPG, PNG/i),
    ).toBeInTheDocument();
  });

  it("should have a file input that accepts correct formats", () => {
    render(<UploadSection />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute("accept", ".pdf,.jpg,.jpeg,.png");
    expect(fileInput).toHaveAttribute("multiple");
  });

  it("should open file picker when select button is clicked", async () => {
    render(<UploadSection />);

    const button = screen.getByText("Select Files");
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const clickSpy = vi.spyOn(fileInput, "click");
    fireEvent.click(button);

    expect(clickSpy).toHaveBeenCalled();
  });

  it("should show drag state when files are dragged over", () => {
    const { container } = render(<UploadSection />);

    // The root element is the drop zone with the border classes
    const dropZone = container.firstChild as HTMLElement;
    if (!dropZone) throw new Error("Drop zone not found");

    fireEvent.dragEnter(dropZone, {
      dataTransfer: { files: [] },
    });

    // The component should change styling when drag is active
    expect(dropZone).toHaveClass("border-blue-500");
  });

  it("should reset drag state when files are dragged away", () => {
    const { container } = render(<UploadSection />);

    const dropZone = container.firstChild as HTMLElement;
    if (!dropZone) throw new Error("Drop zone not found");

    fireEvent.dragEnter(dropZone, {
      dataTransfer: { files: [] },
    });

    fireEvent.dragLeave(dropZone, {
      dataTransfer: { files: [] },
    });

    expect(dropZone).not.toHaveClass("border-blue-500");
  });

  it("should add files when valid files are dropped", () => {
    const { container } = render(<UploadSection />);

    const pdfFile = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });
    const dropZone = container.firstChild as HTMLElement;
    if (!dropZone) throw new Error("Drop zone not found");

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [pdfFile],
      },
    });

    const state = useMergeStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.files[0].name).toBe("test.pdf");
  });

  it("should filter out invalid file types on drop", () => {
    const { container } = render(<UploadSection />);

    const validFile = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });
    const invalidFile = new File(["content"], "test.doc", {
      type: "application/msword",
    });

    const dropZone = container.firstChild as HTMLElement;
    if (!dropZone) throw new Error("Drop zone not found");

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [validFile, invalidFile],
      },
    });

    const state = useMergeStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.files[0].name).toBe("test.pdf");
  });
});
