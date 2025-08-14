import { useRef, useCallback, useState } from 'react';

interface UseFileInputProps {
  onFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
}

interface UseFileInputReturn {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  localError: string | null;
  setLocalError: (error: string | null) => void;
  setDownloadError: (error: string | null) => void;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function useFileInput({ onFileSelect }: UseFileInputProps): UseFileInputReturn {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        setLocalError(null);
        try {
          await onFileSelect(selectedFile);
        } catch (err) {
          setLocalError(err instanceof Error ? err.message : String(err));
        }
      }
      // Reset the input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onFileSelect]
  );

  const setDownloadError = useCallback(() => {
    // This is just to clear download errors when selecting a local file
    // The actual download error state is managed in useUrlDownload hook
  }, []);

  return {
    fileInputRef,
    localError,
    setLocalError,
    setDownloadError,
    handleFileSelect,
  };
}
