/**
  * Folder plugin utilities - UIWorker
  */

import { CreateFolderData } from '../types/types.ts';
import { FOLDER_DISPLAY, FOLDER_VALIDATION } from '../types/constants.ts';

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

/**
 * Display utilities
 */
const isPresetIconColor = (candidate: string): candidate is (typeof FOLDER_DISPLAY.ICON_COLORS)[number] =>
  (FOLDER_DISPLAY.ICON_COLORS as readonly string[]).includes(candidate);

export function isValidIconColor(color: string): boolean {
  return isPresetIconColor(color) || /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function getDefaultIconColor(): string {
  return FOLDER_DISPLAY.DEFAULT_ICON_COLOR;
}

export function getRandomIconColor(): string {
  const colors = FOLDER_DISPLAY.ICON_COLORS;
  return colors[Math.floor(Math.random() * colors.length)] || FOLDER_DISPLAY.DEFAULT_ICON_COLOR;
}

export function sanitizeFolderName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, FOLDER_VALIDATION.NAME_MAX_LENGTH);
}
