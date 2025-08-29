/**
 * @file id-generator.ts
 * @description ID generation utilities for entities
 */



/**
 * Generate a unique entity ID
 */
export function generateEntityId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique node ID
 */
export function generateNodeId(): string {
  return `node_${crypto.randomUUID()}`;
}

/**
 * Generate a unique tree ID
 */
export function generateTreeId(): string {
  return `tree_${crypto.randomUUID()}`;
}

/**
 * Generate a timestamp-based ID
 */
export function generateTimestampId(prefix: string = 'id'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Validate if a string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate if a string is a valid entity ID
 */
export function isValidEntityId(id: string): boolean {
  return isValidUUID(id);
}

/**
 * Validate if a string is a valid node ID
 */
export function isValidNodeId(id: string): boolean {
  return id.startsWith('node_') && isValidUUID(id.substring(5));
}

/**
 * Validate if a string is a valid tree ID
 */
export function isValidTreeId(id: string): boolean {
  return id.startsWith('tree_') && isValidUUID(id.substring(5));
}