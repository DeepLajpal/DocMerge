'use client';

import { CheckCircle2, RotateCcw, TrendingDown } from 'lucide-react';
import { useMergeStore } from '@/lib/store';
import { formatFileSize } from '@/lib/file-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SuccessSummary() {
  const mergeResult = useMergeStore((state) => state.mergeResult);
  const files = useMergeStore((state) => state.files);
  const compressionSettings = useMergeStore((state) => state.compressionSettings);
  const resetApp = useMergeStore((state) => state.resetApp);

  if (!mergeResult) return null;

  // Calculate original size (sum of all input files)
  const originalSize = files.reduce((sum, f) => sum + f.size, 0);
  const compressionRatio = originalSize > 0 ? (1 - mergeResult.finalSize / originalSize) * 100 : 0;
  const savedSize = originalSize - mergeResult.finalSize;

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900">
              PDF successfully merged!
            </h3>

            <div className="mt-3 space-y-2 text-sm text-green-800">
              <p>
                <span className="font-medium">{files.length}</span> files merged into{' '}
                <span className="font-medium">{mergeResult.pages}</span> pages
              </p>
              <p>
                Original combined size:{' '}
                <span className="font-medium">{formatFileSize(originalSize)}</span>
              </p>
              <p>
                Final compressed size:{' '}
                <span className="font-medium">{formatFileSize(mergeResult.finalSize)}</span>
              </p>
              {compressionRatio > 0 && (
                <p className="flex items-center gap-2 text-green-700">
                  <TrendingDown className="h-4 w-4" />
                  <span>
                    Compression savings: <span className="font-medium">{compressionRatio.toFixed(1)}%</span> ({formatFileSize(savedSize)})
                  </span>
                </p>
              )}
              <p className="text-xs pt-1">
                Quality: <span className="capitalize font-medium">{compressionSettings.quality}</span>
              </p>
            </div>

            <Button
              onClick={resetApp}
              variant="outline"
              className="mt-4 gap-2 border-green-300 text-green-700 hover:bg-green-100"
            >
              <RotateCcw className="h-4 w-4" />
              Merge More Files
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
