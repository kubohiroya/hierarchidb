/**
 * @file hashUtils.ts
 * @description Hash utilities for StyleMap plugin
 */

/**
 * Generate a cache key based on filename and style configuration
 */
export async function generateCacheKey(filename?: string, styleMapConfig?: any): Promise<string> {
  const data = JSON.stringify({
    filename: filename || '',
    config: styleMapConfig || {},
    timestamp: Date.now(),
  });

  // Simple hash function for now - could be upgraded to SHA-256 later
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}
