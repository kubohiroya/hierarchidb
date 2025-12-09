/**
  * Folder plugin utilities - UIWorker
  */

import { CreateFolderData } from '../types/types.ts';

/**
 * Validation utilities - now using common validation from @hierarchidb/core
 */

/**
 * @deprecated Use validateNodeName from @hierarchidb/core instead
 */
export function validateFolderName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Name is required' };
  }
  if (name.length > 255) {
    return { isValid: false, error: 'Name is too long' };
  }
  return { isValid: true };
}

/**
 * Validate folder-plugin creation/update data using common validation functions
 */
export function validateFolderData(data: CreateFolderData): { isValid: boolean; errors: string[] } {
  // Simple validation for folder data
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (data.name && data.name.length > 255) {
    errors.push('Name is too long');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}


