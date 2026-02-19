import { FileText } from "lucide-react";
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
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-blue-100 p-3">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-3">
            DocMerge
          </h1>
          <p className="text-xl text-gray-600">
            Merge PDFs and images into a single document
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Fast, secure, and completely in-browser processing
          </p>
        </div>

        {/* Main App */}
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
