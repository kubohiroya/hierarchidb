import { useCallback, useState } from 'react';
export function useDragDrop({
  accept,
  disabled,
  loading,
  isDownloading,
  onFileSelect,
  setLocalError,
  setDownloadError,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const validateFileType = useCallback(
    (file) => {
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
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled && !loading && !isDownloading) {
        setIsDragging(true);
      }
    },
    [disabled, loading, isDownloading]
  );
  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    async (event) => {
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
//# sourceMappingURL=useDragDrop.js.map
