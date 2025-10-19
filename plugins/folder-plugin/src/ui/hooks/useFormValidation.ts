/**
 * Form validation hook for folder-plugin operations
 */

import { useCallback, useMemo, useState } from 'react';
import { validateFolderData, validateFolderName } from '../../common/shared/utils.js';
import { CreateFolderData, UpdateFolderData } from '../../common/types/types.js';

export interface FormValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
}

export interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

/**
 * Form validation hook for folder-plugin forms
 * @deprecated
 */
export function useFormValidation(
  data: Partial<CreateFolderData | UpdateFolderData>,
  options: UseFormValidationOptions = {},
) {
  const { validateOnChange = true, validateOnBlur = true } = options;

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [validationState, setValidationState] = useState<FormValidationResult>({
    isValid: true,
    errors: [],
    fieldErrors: {},
  });

  // Validate entire form
  const validateForm = useCallback((formData: Partial<CreateFolderData | UpdateFolderData>) => {
    const validation = validateFolderData(formData as CreateFolderData);
    const fieldErrors: Record<string, string> = {};

    // Map validation errors to specific fields
    validation.errors.forEach((error) => {
      if (error.includes('name')) {
        fieldErrors.name = error;
      } else if (error.includes('description')) {
        fieldErrors.description = error;
      } else if (error.includes('tag')) {
        fieldErrors.tags = error;
      } else {
        fieldErrors.general = error;
      }
    });

    const result: FormValidationResult = {
      isValid: validation.isValid && Object.keys(fieldErrors).length === 0,
      errors: validation.errors,
      fieldErrors,
    };

    setValidationState(result);
    return result;
  }, []);

  // Validate single field
  const validateField = useCallback((fieldName: string, value: any) => {
    let error = '';

    switch (fieldName) {
      case 'name':
        if (value) {
          const nameValidation = validateFolderName(value);
          if (!nameValidation.isValid) {
            error = nameValidation.error || 'Invalid folder-plugin name';
          }
        } else {
          error = 'Folder name is required';
        }
        break;

      case 'description':
        if (value && value.length > 1000) {
          error = 'Description must be less than 1000 characters';
        }
        break;

      case 'settings.displayOptions.iconColor':
      case 'iconColor':
        if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) {
          error = 'Invalid icon color format';
        }
        break;

      case 'settings.rules.maxChildren':
      case 'maxChildren':
        if (value !== undefined && (typeof value !== 'number' || value < 0 || value > 10000)) {
          error = 'Max children must be between 0 and 10000';
        }
        break;

      case 'tags':
        if (Array.isArray(value)) {
          if (value.length > 10) {
            error = 'Maximum 10 tags allowed';
          } else {
            for (const tag of value) {
              if (typeof tag !== 'string' || tag.length > 50) {
                error = 'Each tag must be a string with max 50 characters';
                break;
              }
            }
          }
        }
        break;
    }

    setValidationState((prev) => ({
      ...prev,
      fieldErrors: {
        ...prev.fieldErrors,
        [fieldName]: error,
      },
    }));

    return error;
  }, []);

  // Handle field change
  const handleFieldChange = useCallback(
    (fieldName: string, value: any) => {
      if (validateOnChange && touched[fieldName]) {
        validateField(fieldName, value);
      }
    },
    [validateOnChange, validateField, touched],
  );

  // Handle field blur
  const handleFieldBlur = useCallback(
    (fieldName: string, value: any) => {
      setTouched((prev) => ({ ...prev, [fieldName]: true }));

      if (validateOnBlur) {
        validateField(fieldName, value);
      }
    },
    [validateOnBlur, validateField],
  );

  // Get error for specific field
  const getFieldError = useCallback(
    (fieldName: string) => {
      return touched[fieldName] ? validationState.fieldErrors[fieldName] : '';
    },
    [touched, validationState.fieldErrors],
  );

  // Check if field has error
  const hasFieldError = useCallback(
    (fieldName: string) => {
      return touched[fieldName] && Boolean(validationState.fieldErrors[fieldName]);
    },
    [touched, validationState.fieldErrors],
  );

  // Current validation result
  const validation = useMemo(() => validateForm(data), [data, validateForm]);

  return {
    validation,
    validateForm,
    validateField,
    handleFieldChange,
    handleFieldBlur,
    getFieldError,
    hasFieldError,
    touched,
    setTouched,
  };
}

/**
 * Simple validation hook for immediate validation
 */
export function useValidation(data: Partial<CreateFolderData | UpdateFolderData>) {
  return useMemo(() => {
    const validation = validateFolderData(data as CreateFolderData);
    const fieldErrors: Record<string, string> = {};

    // Map errors to fields
    validation.errors.forEach((error) => {
      if (error.includes('name')) {
        fieldErrors.name = error;
      } else if (error.includes('description')) {
        fieldErrors.description = error;
      } else if (error.includes('tag')) {
        fieldErrors.tags = error;
      }
    });

    return {
      isValid: validation.isValid,
      errors: validation.errors,
      fieldErrors,
    };
  }, [data]);
}
