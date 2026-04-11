import { generateUUID } from './webCryptoUtils.js';

/**
 * Generate a unique ID for entities using secure randomness.
 */
export function generateId(): string {
  return generateUUID();
}
