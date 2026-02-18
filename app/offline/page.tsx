"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
          <WifiOff className="h-8 w-8 text-gray-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You&apos;re offline
        </h1>
        <p className="text-gray-600 mb-6">
          Please check your internet connection and try again. Don&apos;t worry
          — your files are safe in your browser.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
