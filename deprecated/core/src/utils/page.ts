/**
 * Page theme utilities for consistent styling across the application
 */

export type PageType = 'resources' | 'projects' | 'preview';

/**
 * Get the appropriate button color based on the page type
 */
export function getPageButtonColor(pageType: PageType): 'primary' | 'secondary' | 'inherit' {
  switch (pageType) {
    case 'resources':
      return 'primary';
    case 'projects':
      return 'secondary';
    case 'preview':
      return 'inherit';
    default:
      return 'inherit';
  }
}

/**
 * Get the background color for a given page type (theme-aware)
 * Uses a generic theme interface to avoid MUI dependency in core
 */
export function getPageBackgroundColor(
  pageType: PageType,
  theme: { palette: { background: { paper: string; default: string } } }
): string {
  switch (pageType) {
    case 'resources':
    case 'projects':
      return theme.palette.background.paper;
    case 'preview':
      return theme.palette.background.default;
    default:
      return theme.palette.background.default;
  }
}

/**
 * Get the edit button color based on the page type
 */
export function getEditButtonColor(pageType: PageType): 'primary' | 'secondary' | 'inherit' {
  return getPageButtonColor(pageType);
}

/**
 * Get the preview button color based on the page type
 */
export function getPreviewButtonColor(pageType: PageType): 'primary' | 'secondary' | 'inherit' {
  return getPageButtonColor(pageType);
}

/**
 * Determine the page type from the current URL path
 */
export function determinePageType(pathname: string): PageType | undefined {
  if (pathname.includes('/r/')) {
    return 'resources';
  } else if (pathname.includes('/p/')) {
    return 'projects';
  } else if (pathname.includes('/preview/')) {
    return 'preview';
  }
  return undefined;
}
