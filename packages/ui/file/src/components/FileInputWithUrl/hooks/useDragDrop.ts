import { useCallback, useState } from 'react';

interface UseDragDropProps {
  accept: string;
  disabled: boolean;
  loading: boolean;
  isDownloading: boolean;
  onFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;
  setLocalError: (error: string | null) => void;
  setDownloadError: (error: string | null) => void;
}

interface UseDragDropReturn {
  isDragging: boolean;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => Promise<void>;
}

export function useDragDrop({
  accept,
  disabled,
  loading,
  isDownloading,
  onFileSelect,
  setLocalError,
  setDownloadError,
}: UseDragDropProps): UseDragDropReturn {
  const [isDragging, setIsDragging] = useState(false);

  const validateFileType = useCallback(
    (file: File): boolean => {
      if (accept === '*') return true;

      const acceptedExtensions = accept
        .split(',')
        .map((ext) => ext.trim().toLowerCase())
        .filter((ext) => ext.startsWith('.'));

      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isAccepted = acceptedExtensions.some((ext) => fileExtension === ext);

      if (!isAccepted) {
        setLocalError(
          `Please drop a file with one of these extensions: ${acceptedExtensions.join(', ')}`
        );
        return false;
      }

      return true;
    },
    [accept, setLocalError]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled && !loading && !isDownloading) {
        setIsDragging(true);
      }
    },
    [disabled, loading, isDownloading]
  );

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      if (disabled || loading || isDownloading) {
        return;
      }

      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) {
        return;
      }

      const file = files[0];
      if (!file) {
        return;
      }

      // Validate file type
      if (!validateFileType(file)) {
        return;
      }

      setLocalError(null);
      setDownloadError(null);

      try {
        await onFileSelect(file);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : String(err));
      }
    },
    [
      disabled,
      loading,
      isDownloading,
      validateFileType,
      setLocalError,
      setDownloadError,
      onFileSelect,
    ]
  );

  return {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
