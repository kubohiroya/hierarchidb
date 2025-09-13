/**
 * register-default-extensions
 * Initializes common folder dialog extensions (shape, spreadsheet, basemap, styler) if available.
 * Safe to call multiple times; underlying registry ignores duplicate registrations.
 */

export async function initializeDefaultFolderExtensions(): Promise<void> {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    console.warn('[Deprecation] initializeDefaultFolderExtensions is deprecated. Use initializeDefaultNodeDialogExtensions instead.');
  }
  const inits: Array<() => Promise<void>> = [];

  // Helper to try dynamic import (optional dependency)
  const tryInit = async <T>(loader: () => Promise<T>, pick: (m: T) => (() => Promise<void>) | undefined) => {
    try {
      const mod = await loader();
      const fn = pick(mod);
      if (typeof fn === 'function') {
        inits.push(fn);
      }
    } catch {
      // ignore missing packages or load errors in environments that don't bundle these plugins
    }
  };

  // Avoid TS resolving optional deps by using non-literal specifiers
  const SHAPE = '@hierarchidb/shape-plugin' as string;
  const SHEET = '@hierarchidb/spreadsheet-plugin' as string;
  const BASEMAP = '@hierarchidb/basemap-plugin' as string;
  const STYLER = '@hierarchidb/styler-plugin' as string;

  await Promise.all([
    tryInit(() => import(/* @vite-ignore */ SHAPE), (m: any) => (m as any).initializeShapeFolderExtension),
    tryInit(() => import(/* @vite-ignore */ SHEET), (m: any) => (m as any).initializeSpreadsheetFolderExtension),
    tryInit(() => import(/* @vite-ignore */ BASEMAP), (m: any) => (m as any).initializeBaseMapFolderExtension),
    tryInit(() => import(/* @vite-ignore */ STYLER), (m: any) => (m as any).initializeStylerFolderExtension),
  ]);

  for (const fn of inits) {
    await fn();
  }
}

/**
 * Generic name that doesn’t assume “folder” as a concept.
 * Prefer this in new code. Backed by the same implementation as the deprecated function.
 */
export async function initializeDefaultNodeDialogExtensions(): Promise<void> {
  return initializeDefaultFolderExtensions();
}
