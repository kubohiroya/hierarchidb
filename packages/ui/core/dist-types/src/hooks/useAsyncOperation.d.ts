/**
 * useAsyncOperation Hook
 *
 * A generic hook for handling asynchronous operations with loading and error states.
 * Reduces boilerplate code for try-catch-finally patterns across the application.
 */
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
export declare function useAsyncOperation<T = any>(): UseAsyncOperationResult<T>;
//# sourceMappingURL=useAsyncOperation.d.ts.map