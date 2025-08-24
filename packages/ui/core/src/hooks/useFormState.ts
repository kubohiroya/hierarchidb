/**
 * useFormState Hook
 * 
 * A generic hook for managing form state with validation and error handling.
 * Reduces boilerplate code for form management across dialog containers.
 */

import { useState, useCallback, useMemo } from 'react';
import { useAsyncOperation } from './useAsyncOperation';

// Utility function to omit keys from an object that maintains proper type safety
function omitErrorField(errors: Record<string, string>, field: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (key !== field) {
      result[key] = value;
    }
  }
  return result;
}

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
export function useFormState<T extends Record<string, any>>(
  options: UseFormStateOptions<T>
): UseFormStateResult<T> {
  const {
    initialData,
    validate,
    validateOnChange = false,
    validateOnBlur = true,
  } = options;

  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { execute: executeAsync, loading } = useAsyncOperation();

  // Check if form is dirty
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  // Check if form is valid
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  // Update a single field
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (validateOnChange && validate) {
      const newData = { ...formData, [field]: value };
      const validationErrors = validate(newData);
      if (validationErrors) {
        setErrors(prev => ({ ...prev, [field]: validationErrors[field as string] || '' }));
      } else {
        setErrors(prev => omitErrorField(prev, field as string));
      }
    }
  }, [formData, validate, validateOnChange]);

  // Update multiple fields
  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    
    if (validateOnChange && validate) {
      const newData = { ...formData, ...updates };
      const validationErrors = validate(newData);
      setErrors(validationErrors || {});
    }
  }, [formData, validate, validateOnChange]);

  // Touch a field
  const touchField = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    if (validateOnBlur && validate) {
      const validationErrors = validate(formData);
      if (validationErrors && validationErrors[field as string]) {
        const errorMessage = validationErrors[field as string];
        if (errorMessage) {
          setErrors(prev => ({ ...prev, [field as string]: errorMessage }));
        }
      } else {
        setErrors(prev => omitErrorField(prev, field as string));
      }
    }
  }, [formData, validate, validateOnBlur]);

  // Validate a single field
  const validateField = useCallback((field: keyof T): boolean => {
    if (!validate) return true;
    
    const validationErrors = validate(formData);
    if (validationErrors && validationErrors[field as string]) {
      const errorMessage = validationErrors[field as string];
      if (errorMessage) {
        setErrors(prev => ({ ...prev, [field as string]: errorMessage }));
      }
      return false;
    } else {
      setErrors(prev => omitErrorField(prev, field as string));
      return true;
    }
  }, [formData, validate]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    if (!validate) return true;
    
    const validationErrors = validate(formData);
    if (validationErrors) {
      setErrors(validationErrors);
      // Mark all fields with errors as touched
      Object.keys(validationErrors).forEach(field => {
        setTouched(prev => ({ ...prev, [field]: true }));
      });
      return false;
    } else {
      setErrors({});
      return true;
    }
  }, [formData, validate]);

  // Reset form
  const reset = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setTouched({});
  }, [initialData]);

  // Set all form data
  const setFormDataHandler = useCallback((data: T) => {
    setFormData(data);
    if (validateOnChange && validate) {
      const validationErrors = validate(data);
      setErrors(validationErrors || {});
    }
  }, [validate, validateOnChange]);

  // Execute async operation
  const execute = useCallback(async (operation: (data: T) => Promise<any>) => {
    if (!validateForm()) {
      return undefined;
    }
    
    return executeAsync(() => operation(formData));
  }, [formData, validateForm, executeAsync]);

  // Set field error
  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field as string]: error }));
    setTouched(prev => ({ ...prev, [field as string]: true }));
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    formData,
    errors,
    touched,
    loading,
    isDirty,
    isValid,
    updateField,
    updateFields,
    touchField,
    validateField,
    validateForm,
    reset,
    setFormData: setFormDataHandler,
    execute,
    setFieldError,
    clearErrors,
  };
}