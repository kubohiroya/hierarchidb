/**
 * Validates an external URL for safety and correctness
 * @param url The URL to validate
 * @returns Object with validation result and sanitized URL
 */
export function validateExternalURL(url) {
  try {
    // Remove leading/trailing whitespace
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return { valid: false, error: 'URL is required' };
    }
    // Parse URL
    const parsedUrl = new URL(trimmedUrl);
    // Check protocol (only allow http and https)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }
    // Basic sanitization: encode special characters in pathname
    parsedUrl.pathname = parsedUrl.pathname
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
    return { valid: true, url: parsedUrl.toString() };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}
//# sourceMappingURL=validation.js.map
