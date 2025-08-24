/**
 * @file imageUtils.ts
 * @description Utilities for handling image loading and caching
 */

/**
 * Preload an image and cache it
 */
export const preloadImage = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      resolve(true);
    };

    img.onerror = () => {
      resolve(false);
    };

    // Set crossOrigin before src to avoid CORS issues
    img.crossOrigin = 'anonymous';
    img.src = url;

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!img.complete) {
        resolve(false);
      }
    }, 10000);
  });
};

/**
 * Test if an image URL is accessible
 */
export const testImageUrl = async (url: string): Promise<boolean> => {
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors', // Avoid CORS issues for testing
    });

    // In no-cors mode, we can't check the actual status
    // but if fetch doesn't throw, the URL is likely accessible
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Create a cache-busting URL
 */
export const addCacheBuster = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

/**
 * Convert Google profile URL to different sizes
 */
export const getGoogleImageVariants = (url: string): string[] => {
  if (!url.includes('googleusercontent.com')) {
    return [url];
  }

  const baseUrl = url.replace(/=s\d+(-c)?$/, '');
  return [
    `${baseUrl}=s96`, // Small size
    `${baseUrl}=s128`, // Medium size
    `${baseUrl}=s200`, // Large size
    baseUrl, // Original without size parameter
  ];
};