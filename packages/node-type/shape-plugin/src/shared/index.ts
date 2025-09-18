/**
  * Shared layer exports - UI/Worker
  */

// API interface
export * from './api.js';

// Types
export * from './types.js';
// Bridge legacy worker/UI event types used by hooks/components
export type { BatchProgressEvent } from '../types/BatchProgressEvent.js';

// Metadata
export * from './metadata.js';

// Constants
export * from './constants.js';

// Utilities
export * from './utils.js';
