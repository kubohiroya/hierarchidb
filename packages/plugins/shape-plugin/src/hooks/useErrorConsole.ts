import { useCallback, useState } from 'react';

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  level: 'critical' | 'error' | 'warning' | 'info';
  phase: string;
  message: string;
  details?: string;
  rowNumber?: number;
  columnName?: string;
}

interface UseErrorConsoleReturn {
  errors: ErrorLogEntry[];
  addError: (message: string, options?: {
    level?: ErrorLogEntry['level'];
    phase?: string;
    details?: string;
    rowNumber?: number;
    columnName?: string;
  }) => void;
  clearErrors: () => void;
  errorCount: number;
  hasErrors: boolean;
}

export const useErrorConsole = (): UseErrorConsoleReturn => {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);

  const addError = useCallback((
    message: string,
    options: {
      level?: ErrorLogEntry['level'];
      phase?: string;
      details?: string;
      rowNumber?: number;
      columnName?: string;
    } = {},
  ) => {
    const newError: ErrorLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level: options.level || 'error',
      phase: options.phase || 'processing',
      message,
      details: options.details,
      rowNumber: options.rowNumber,
      columnName: options.columnName,
    };

    setErrors(prev => [...prev, newError]);
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