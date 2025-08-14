import { useState, useCallback } from 'react';

export const useFileInput = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileSelect = useCallback((file: File, originalUrl?: string) => {
    setSelectedFile(file);
    setError('');
    // Additional file processing logic can be added here
    console.log('File selected:', file.name, originalUrl);
  }, []);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setError('');
  }, []);

  return {
    selectedFile,
    error,
    handleFileSelect,
    clearFile,
    setError,
  };
};
