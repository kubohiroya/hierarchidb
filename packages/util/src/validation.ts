/**
 * Validation utilities for various data types
 */

/**
 * Validate and sanitize external URLs
 * @param url URL string to validate
 * @returns Validation result with sanitized URL if valid
 */
export function validateExternalURL(
  url: string,
): { isValid: boolean; valid?: boolean; error?: string; url?: string } {
  try {
    // Remove leading/trailing whitespace
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return { isValid: false, valid: false, error: 'URL is required' };
    }

    // Parse URL
    const parsedUrl = new URL(trimmedUrl);

    // Check protocol (only allow http and https)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Basic sanitization: encode special characters in pathname
    parsedUrl.pathname = parsedUrl.pathname
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');

    return {
      isValid: true,
      valid: true,
      url: parsedUrl.toString(),
    };
  } catch {
    return { isValid: false, valid: false, error: 'Invalid URL format' };
  }
}