/**
 * Generate a unique ID for entities
 */
export function generateId(): string {
  return crypto.randomUUID();
}
