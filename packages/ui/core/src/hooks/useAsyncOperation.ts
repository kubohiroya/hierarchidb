/**
 * useAsyncOperation Hook
 * 
 * A generic hook for handling asynchronous operations with loading and error states.
 * Reduces boilerplate code for try-catch-finally patterns across the application.
 */

import { useState, useCallback } from 'react';

export interface UseAsyncOperationResult<T> {
  execute: (operation: () => Promise<T>) => Promise<T | undefined>;
  loading: boolean;
  error: Error | null;
  data: T | null;
  reset: () => void;
}

/**
 * Hook for managing async operations with consistent loading/error handling
 * 
 * @example
 * ```typescript
 * const { execute, loading, error } = useAsyncOperation<User>();
 * 
 * const handleSubmit = async () => {
 *   const result = await execute(async () => {
 *     return await api.createUser(formData);
 *   });
 *   if (result) {
 *     // Success handling
 *   }
 * };
 * ```
 */
export function useAsyncOperation<T = any>(): UseAsyncOperationResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('Async operation failed:', error);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { execute, loading, error, data, reset };
}