import { useState, useCallback } from 'react';

interface UseErrorConsoleReturn {
  errors: string[];
  addError: (error: string) => void;
  clearErrors: () => void;
  errorCount: number;
  hasErrors: boolean;
}

export const useErrorConsole = (): UseErrorConsoleReturn => {
  const [errors, setErrors] = useState<string[]>([]);

  const addError = useCallback((error: string) => {
    setErrors(prev => [...prev, error]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return {
    errors,
    addError,
    clearErrors,
    errorCount: errors.length,
    hasErrors: errors.length > 0,
  };
};