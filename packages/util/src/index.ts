/**
 * @hierarchidb/util
 * General purpose utility functions for HierarchiDB
 * 
 * This package contains standalone utility functions that do not depend on
 * any other HierarchiDB packages. These utilities are designed to be
 * reusable across the entire project.
 */

// Formatting utilities
export {
  formatBytes,
  clampPercentage,
  getMemorySeverity
} from './format';

// Validation utilities
export {
  validateExternalURL
} from './validation';