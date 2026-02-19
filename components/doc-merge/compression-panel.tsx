"use client";

import { useMergeStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CONFIG } from "@/lib/config";
import { checkServerLimits, getServerLimitsSummary } from "@/lib/server-limits";
import { Monitor, Server, Wifi, WifiOff } from "lucide-react";

export function CompressionPanel() {
  const compressionSettings = useMergeStore(
    (state) => state.compressionSettings,
  );
  const updateCompressionSettings = useMergeStore(
    (state) => state.updateCompressionSettings,
  );
  const files = useMergeStore((state) => state.files);

  // Check server processing availability
  const serverLimits = getServerLimitsSummary();
  const serverValidation = checkServerLimits(files);
  const isServerAvailable = serverLimits.enabled && serverValidation.valid;

  const qualityLevels = [
    { value: "high", label: "High (Best Quality)", color: "text-green-600" },
    { value: "balanced", label: "Balanced", color: "text-blue-600" },
    {
      value: "small",
      label: "Small (Best Compression)",
      color: "text-orange-600",
    },
  ] as const;

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg">Compression Settings</CardTitle>
        <CardDescription>Optimize your PDF size (optional)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Target File Size
          </label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={compressionSettings.targetSize}
              onChange={(e) =>
                updateCompressionSettings({
                  targetSize: Math.max(1, parseFloat(e.target.value) || 1),
                })
              }
              min="1"
              max="500"
              className="flex-1"
            />
            <Select
              value={compressionSettings.targetUnit}
              onValueChange={(value: any) =>
                updateCompressionSettings({ targetUnit: value })
              }
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KB">KB</SelectItem>
                <SelectItem value="MB">MB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quality Slider */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Quality
            </label>
            <span
              className={`text-sm font-medium ${
                qualityLevels.find(
                  (q) => q.value === compressionSettings.quality,
                )?.color
              }`}
            >
              {
                qualityLevels.find(
                  (q) => q.value === compressionSettings.quality,
                )?.label
              }
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              {qualityLevels.map((level) => (
                <button
                  key={level.value}
                  onClick={() =>
                    updateCompressionSettings({ quality: level.value })
                  }
                  className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${
                    compressionSettings.quality === level.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Processing Mode Toggle */}
        {serverLimits.enabled && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Processing Mode
              </label>
              {compressionSettings.processingMode === "server" &&
                !serverValidation.valid && (
                  <span className="text-xs text-amber-600">
                    {serverValidation.errors[0]}
                  </span>
                )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  updateCompressionSettings({ processingMode: "browser" })
                }
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-xs font-medium transition-colors ${
                  compressionSettings.processingMode === "browser"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Monitor className="h-4 w-4" />
                <div className="text-left">
                  <div>Device</div>
                  <div className="text-[10px] font-normal opacity-70">
                    Works offline
                  </div>
                </div>
              </button>

              <button
                onClick={() =>
                  isServerAvailable
                    ? updateCompressionSettings({ processingMode: "server" })
                    : null
                }
                disabled={!isServerAvailable}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-xs font-medium transition-colors ${
                  compressionSettings.processingMode === "server"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : isServerAvailable
                      ? "border-gray-200 text-gray-600 hover:border-gray-300"
                      : "border-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Server className="h-4 w-4" />
                <div className="text-left">
                  <div>Server</div>
                  <div className="text-[10px] font-normal opacity-70">
                    {isServerAvailable
                      ? "Guaranteed quality"
                      : files.length === 0
                        ? "Add files first"
                        : "Files too large"}
                  </div>
                </div>
              </button>
            </div>

            {/* Server limits info */}
            {compressionSettings.processingMode === "server" && (
              <div className="mt-2 rounded-lg bg-purple-50 p-2 text-xs text-purple-700">
                <p>
                  <strong>Server limits:</strong> Max {serverLimits.maxFiles}{" "}
                  files, {serverLimits.maxFileSize}/file,{" "}
                  {serverLimits.maxTotalSize} total
                </p>
              </div>
            )}

            {compressionSettings.processingMode === "browser" && (
              <div className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-700">
                <p>
                  <strong>Device mode:</strong> No file limits. Works offline.{" "}
                  Some mobile devices may have quality limitations.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Compression Method Info */}
        <div className="space-y-3">
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <p className="font-medium mb-2">Compression Techniques Applied:</p>
            <ul className="space-y-1 ml-3 list-disc text-xs">
              <li>
                <strong>PDF Page Rendering:</strong>{" "}
                {compressionSettings.quality === "high"
                  ? "Pages copied directly (no quality loss)"
                  : "Pages re-rendered as optimized images"}
              </li>
              <li>
                <strong>DPI Scaling:</strong>{" "}
                {compressionSettings.quality === "high"
                  ? "144 DPI (high resolution)"
                  : compressionSettings.quality === "balanced"
                    ? "108 DPI (balanced)"
                    : "72 DPI (smaller files)"}
              </li>
              <li>
                <strong>Image Compression:</strong>{" "}
                {compressionSettings.quality === "high"
                  ? "Lossless format for best quality"
                  : compressionSettings.quality === "balanced"
                    ? "JPEG at 85% quality"
                    : "JPEG at 75% quality"}
              </li>
              <li>
                <strong>Stream Optimization:</strong> Object stream compression
                enabled
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Estimated Size Reduction:</p>
            <p className="text-xs">
              {compressionSettings.quality === "high"
                ? "Minimal (~0-10% reduction) - preserves text selection"
                : compressionSettings.quality === "balanced"
                  ? "Moderate (~40-60% reduction) - converts to image-based PDF"
                  : "Maximum (~60-80% reduction) - converts to image-based PDF"}
            </p>
          </div>

          {compressionSettings.quality !== "high" && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium mb-1">⚠️ Note:</p>
              <p className="text-xs">
                Balanced/Small compression converts PDF pages to images. Text
                will no longer be selectable. Use "High" to preserve text.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
