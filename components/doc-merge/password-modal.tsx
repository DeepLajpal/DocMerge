'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { UploadedFile } from '@/lib/types';
import { useMergeStore } from '@/lib/store';
import { validatePDFPassword } from '@/lib/pdf-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PasswordModalProps {
  file: UploadedFile;
  onClose: () => void;
}

export function PasswordModal({ file, onClose }: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const updatePassword = useMergeStore((state) => state.updatePassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const isValid = await validatePDFPassword(file.file, password);

      if (isValid) {
        updatePassword(file.id, password);
        onClose();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      console.error('Password validation error:', err);
      setError('Error validating password. Please try again.');
    }

    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-amber-100 p-2">
              <Lock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <DialogTitle>Password Required</DialogTitle>
              <DialogDescription className="mt-1">
                This PDF is password protected
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Enter password for {file.name}
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter password"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!password || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Validating...' : 'Confirm'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
