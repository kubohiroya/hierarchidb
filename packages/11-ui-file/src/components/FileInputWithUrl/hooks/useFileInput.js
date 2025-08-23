import { useRef, useCallback, useState } from 'react';
export function useFileInput({ onFileSelect }) {
  const fileInputRef = useRef(null);
  const [localError, setLocalError] = useState(null);
  const handleFileSelect = useCallback(
    async (event) => {
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
//# sourceMappingURL=useFileInput.js.map
