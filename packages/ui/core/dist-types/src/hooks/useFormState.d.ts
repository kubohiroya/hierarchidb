/**
 * useFormState Hook
 *
 * A generic hook for managing form state with validation and error handling.
 * Reduces boilerplate code for form management across base-dialog containers.
 */
export interface FormFieldError {
    message: string;
    field: string;
}
export interface UseFormStateOptions<T> {
    /**
     * Initial form data
     */
    initialData: T;
    /**
     * Optional validation function
     */
    validate?: (data: T) => Record<string, string> | null;
    /**
     * Whether to validate on field change
     */
    validateOnChange?: boolean;
    /**
     * Whether to validate on field blur
     */
    validateOnBlur?: boolean;
}
export interface UseFormStateResult<T> {
    /**
     * Current form data
     */
    formData: T;
    /**
     * Field-level errors
     */
    errors: Record<string, string>;
    /**
     * Fields that have been touched/modified
     */
    touched: Record<string, boolean>;
    /**
     * Loading state from async operations
     */
    loading: boolean;
    /**
     * Whether the form has been modified
     */
    isDirty: boolean;
    /**
     * Whether the form is valid
     */
    isValid: boolean;
    /**
     * Update a single field
     */
    updateField: <K extends keyof T>(field: K, value: T[K]) => void;
    /**
     * Update multiple fields at once
     */
    updateFields: (updates: Partial<T>) => void;
    /**
     * Mark a field as touched
     */
    touchField: (field: keyof T) => void;
    /**
     * Validate a single field
     */
    validateField: (field: keyof T) => boolean;
    /**
     * Validate all fields
     */
    validateForm: () => boolean;
    /**
     * Reset form to initial state
     */
    reset: () => void;
    /**
     * Set all form data at once
     */
    setFormData: (data: T) => void;
    /**
     * Execute an async operation with the form data
     */
    execute: (operation: (data: T) => Promise<any>) => Promise<any>;
    /**
     * Set a specific error for a field
     */
    setFieldError: (field: keyof T, error: string) => void;
    /**
     * Clear all errors
     */
    clearErrors: () => void;
}
/**
 * Hook for managing form state with validation
 *
 * @example
 * ```typescript
 * const form = useFormState({
 *   initialData: { name: '', description: '' },
 *   validate: (data) => {
 *     const errors: Record<string, string> = {};
 *     if (!data.name) errors.name = 'Name is required';
 *     return Object.keys(errors).length > 0 ? errors : null;
 *   }
 * });
 *
 * const handleSubmit = async () => {
 *   if (form.validateForm()) {
 *     await form.execute(async (data) => {
 *       return await api.create(data);
 *     });
 *   }
 * };
 * ```
 */
export declare function useFormState<T extends Record<string, any>>(options: UseFormStateOptions<T>): UseFormStateResult<T>;
//# sourceMappingURL=useFormState.d.ts.map