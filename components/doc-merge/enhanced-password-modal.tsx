'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
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

interface EnhancedPasswordModalProps {
  file: UploadedFile;
  onClose: () => void;
}

type ValidationStatus = 'idle' | 'validating' | 'success' | 'error';

export function EnhancedPasswordModal({ file, onClose }: EnhancedPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const updatePassword = useMergeStore((state) => state.updatePassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('validating');
    setError('');

    try {
      const isValid = await validatePDFPassword(file.file, password);

      if (isValid) {
        setStatus('success');
        updatePassword(file.id, password);
        
        // Show success animation briefly before closing
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setStatus('error');
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      console.error('Password validation error:', err);
      setStatus('error');
      setError('Error validating password. Please try again.');
    }

    setLoading(false);
  };

  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        {/* Header with animated lock icon */}
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2 transition-all duration-500 ${
                isSuccess
                  ? 'bg-green-100 scale-110'
                  : isError
                  ? 'bg-red-100 shake'
                  : 'bg-amber-100'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 animate-pulse" />
              ) : isError ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : (
                <Lock className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div>
              <DialogTitle>
                {isSuccess ? 'Password Unlocked!' : 'Password Required'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isSuccess
                  ? 'File is ready to merge'
                  : 'This PDF is password protected'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Enter password for {file.name}
            </label>

            {/* Password input with toggle */}
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                  if (status === 'error') setStatus('idle');
                }}
                placeholder="Enter password"
                autoFocus
                disabled={isSuccess}
                className={`pr-10 transition-colors ${
                  isSuccess
                    ? 'bg-green-50 border-green-200 text-gray-500'
                    : isError
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300'
                }`}
              />

              {/* Show/Hide toggle button */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSuccess || !password}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Error message with animation */}
            {error && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success message */}
            {isSuccess && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Password accepted!</span>
              </div>
            )}

            {/* Password strength indicator */}
            {password && !isSuccess && (
              <div className="mt-2 text-xs text-gray-500">
                {password.length < 4
                  ? 'Enter a longer password'
                  : password.length < 8
                  ? 'Password entered'
                  : 'Strong password'}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSuccess || loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!password || loading || isSuccess}
              className={`transition-all ${
                isSuccess
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Unlocked
                </>
              ) : loading ? (
                <>
                  <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Validating...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </div>

          {/* Real-time feedback */}
          {status === 'validating' && (
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600 py-2 bg-blue-50 rounded animate-pulse">
              <div className="h-2 w-2 bg-blue-600 rounded-full" />
              Validating password...
            </div>
          )}
        </form>

        {/* CSS for shake animation */}
        <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          .shake {
            animation: shake 0.3s ease-in-out;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
