'use client';

import { useMergeStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function OutputSettings() {
  const outputSettings = useMergeStore((state) => state.outputSettings);
  const updateOutputSettings = useMergeStore((state) => state.updateOutputSettings);

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg">Output Settings</CardTitle>
        <CardDescription>Customize your merged PDF</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Page Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Page Size
          </label>
          <Select
            value={outputSettings.pageSize}
            onValueChange={(value: any) =>
              updateOutputSettings({ pageSize: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
              <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
              <SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom Dimensions */}
        {outputSettings.pageSize === 'Custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Width (mm)
              </label>
              <Input
                type="number"
                value={outputSettings.customWidth || ''}
                onChange={(e) =>
                  updateOutputSettings({
                    customWidth: parseFloat(e.target.value),
                  })
                }
                placeholder="210"
                min="10"
                max="1000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Height (mm)
              </label>
              <Input
                type="number"
                value={outputSettings.customHeight || ''}
                onChange={(e) =>
                  updateOutputSettings({
                    customHeight: parseFloat(e.target.value),
                  })
                }
                placeholder="297"
                min="10"
                max="1000"
              />
            </div>
          </div>
        )}

        {/* Orientation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Orientation
          </label>
          <div className="flex gap-2">
            {(['portrait', 'landscape'] as const).map((orientation) => (
              <Button
                key={orientation}
                variant={
                  outputSettings.orientation === orientation ? 'default' : 'outline'
                }
                className="flex-1 capitalize"
                onClick={() => updateOutputSettings({ orientation })}
              >
                {orientation}
              </Button>
            ))}
          </div>
        </div>

        {/* Filename */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filename
          </label>
          <div className="flex gap-2">
            <Input
              value={outputSettings.filename}
              onChange={(e) =>
                updateOutputSettings({ filename: e.target.value })
              }
              placeholder="merged-document"
            />
            <span className="flex items-center text-sm text-gray-500">.pdf</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
