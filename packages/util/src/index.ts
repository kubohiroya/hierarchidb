/**
 * @hierarchidb/util
 * General purpose utility functions for HierarchiDB
 *
 * This package contains standalone utility functions that do not depend on
 * any other HierarchiDB packages. These utilities are designed to be
 * reusable across the entire project.
 */

// Formatting utilities
export * from './format.js';

// Validation utilities
export * from './validation.js';
export { SingletonMixin } from './SingletonMixin.js';
export { generateId } from './generateId.js';
export * from './db-name.js';
export * from './env.js';
export * from './dualKeyMap.js';
// Note: Dexie-specific helpers are internal; avoid leaking Dexie types to consumers
