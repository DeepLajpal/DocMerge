import { test, expect } from "@playwright/test";
import path from "path";

test.describe("DocMerge App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the main heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "DocMerge" })).toBeVisible();
  });

  test("should display the upload section", async ({ page }) => {
    await expect(page.getByText("Upload your files")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Select Files" }),
    ).toBeVisible();
  });

  test("should display supported formats text", async ({ page }) => {
    await expect(
      page.getByText(/Supported formats: PDF, JPG, PNG/i),
    ).toBeVisible();
  });

  test("should have a disabled merge button when no files are uploaded", async ({
    page,
  }) => {
    const mergeButton = page.getByRole("button", { name: /merge/i });
    await expect(mergeButton).toBeDisabled();
  });

  test("should show file information text when no files are uploaded", async ({
    page,
  }) => {
    await expect(
      page.getByText(/upload at least one file to merge/i),
    ).toBeVisible();
  });
});

test.describe("File Upload Flow", () => {
  test("should upload a PDF file via file input", async ({ page }) => {
    await page.goto("/");

    // Create a simple PDF-like file for testing
    const pdfContent = "%PDF-1.4 test content";

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Select Files" }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: "test-document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdfContent),
    });

    // File should appear in the list
    await expect(page.getByText("test-document.pdf")).toBeVisible({
      timeout: 5000,
    });

    // Merge button should now be enabled
    const mergeButton = page.getByRole("button", { name: /merge/i });
    await expect(mergeButton).toBeEnabled();
  });

  test("should upload multiple files", async ({ page }) => {
    await page.goto("/");

    const pdfContent = "%PDF-1.4 test content";

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Select Files" }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles([
      {
        name: "document1.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(pdfContent),
      },
      {
        name: "document2.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(pdfContent),
      },
    ]);

    await expect(page.getByText("document1.pdf")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("document2.pdf")).toBeVisible();
  });

  test("should remove a file when delete button is clicked", async ({
    page,
  }) => {
    await page.goto("/");

    const pdfContent = "%PDF-1.4 test content";

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Select Files" }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: "to-delete.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdfContent),
    });

    await expect(page.getByText("to-delete.pdf")).toBeVisible({
      timeout: 5000,
    });

    // Find and click the delete button
    await page.getByRole("button", { name: /remove/i }).click();

    // File should be removed
    await expect(page.getByText("to-delete.pdf")).not.toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test("should have proper page structure", async ({ page }) => {
    await page.goto("/");

    // Check for main landmark
    await expect(page.locator("main")).toBeVisible();

    // Check for proper heading hierarchy
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
  });

  test("should be keyboard navigable", async ({ page }) => {
    await page.goto("/");

    // Tab to the select files button
    await page.keyboard.press("Tab");

    // Should eventually reach the button
    for (let i = 0; i < 10; i++) {
      const focusedElement = page.locator(":focus");
      if ((await focusedElement.getAttribute("role")) === "button") {
        break;
      }
      await page.keyboard.press("Tab");
    }

    // A button should be focusable
    const focusedButton = page.locator("button:focus");
    await expect(focusedButton).toBeVisible();
  });
});

test.describe("Responsive Design", () => {
  test("should render correctly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "DocMerge" })).toBeVisible();
    await expect(page.getByText("Upload your files")).toBeVisible();
  });

  test("should render correctly on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "DocMerge" })).toBeVisible();
    await expect(page.getByText("Upload your files")).toBeVisible();
  });
});
