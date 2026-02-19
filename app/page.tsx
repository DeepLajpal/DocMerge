import { DocMergeApp } from "@/components/doc-merge-app";

export const metadata = {
  title: "DocMerge - PDF & Image Merger",
  description:
    "Merge PDFs and images into a single document. Fast, secure, and completely in-browser.",
};

export default function Home() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-linear-to-b from-gray-50 to-white py-12 px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        {/* Main App (includes header) */}
        <DocMergeApp />

        {/* Footer */}
        <div className="mt-12 border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
          <p>
            All processing happens in your browser. Your files are never
            uploaded to any server.
          </p>
        </div>
      </div>
    </main>
  );
}
