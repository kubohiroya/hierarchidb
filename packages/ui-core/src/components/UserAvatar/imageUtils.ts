/**
 * @file imageUtils.ts
 * @description Local image utilities for UserAvatar component
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

    // Set crossOrigin before lib to avoid CORS issues
    img.crossOrigin = "anonymous";
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
 * Convert Google profile URL to different sizes
 */
export const getGoogleImageVariants = (url: string): string[] => {
  if (!url.includes("googleusercontent.com")) {
    return [url];
  }

  const baseUrl = url.replace(/=s\d+(-c)?$/, "");
  return [
    `${baseUrl}=s96`, // Small size
    `${baseUrl}=s128`, // Medium size
    `${baseUrl}=s200`, // Large size
    baseUrl, // Original without size parameter
  ];
};