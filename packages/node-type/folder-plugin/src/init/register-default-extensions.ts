/**
 * register-default-extensions
 * Initializes common folder dialog extensions (shape, spreadsheet, basemap, styler) if available.
 * Safe to call multiple times; underlying registry ignores duplicate registrations.
 */

import { readRuntimeMode } from '@hierarchidb/util';

async function registerNodeDialogDefaults(): Promise<void> {
  const inits: Array<() => Promise<void>> = [];

  // Helper to try dynamic import (optional dependency)
  const tryInit = async <T>(loader: () => Promise<T>, pick: (module: T) => (() => Promise<void>) | undefined) => {
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
  const SHAPE = '@hierarchidb/node-type-shape-plugin' as string;
  const SHEET = '@hierarchidb/node-type-spreadsheet-plugin' as string;
  const BASEMAP = '@hierarchidb/node-type-basemap-plugin' as string;
  const STYLER = '@hierarchidb/node-type-styler-plugin' as string;

  await Promise.all([
    tryInit<ShapeExtensionModule>(
      () => import(/* @vite-ignore */ SHAPE) as Promise<ShapeExtensionModule>,
      (mod) => mod.initializeShapeFolderExtension,
    ),
    tryInit<SpreadsheetExtensionModule>(
      () => import(/* @vite-ignore */ SHEET) as Promise<SpreadsheetExtensionModule>,
      (mod) => mod.initializeSpreadsheetFolderExtension,
    ),
    tryInit<BaseMapExtensionModule>(
      () => import(/* @vite-ignore */ BASEMAP) as Promise<BaseMapExtensionModule>,
      (mod) => mod.initializeBaseMapFolderExtension,
    ),
    tryInit<StylerExtensionModule>(
      () => import(/* @vite-ignore */ STYLER) as Promise<StylerExtensionModule>,
      (mod) => mod.initializeStylerFolderExtension,
    ),
  ]);

  for (const fn of inits) {
    await fn();
  }
}

interface ShapeExtensionModule {
  initializeShapeFolderExtension?: () => Promise<void>;
}

interface SpreadsheetExtensionModule {
  initializeSpreadsheetFolderExtension?: () => Promise<void>;
}

interface BaseMapExtensionModule {
  initializeBaseMapFolderExtension?: () => Promise<void>;
}

interface StylerExtensionModule {
  initializeStylerFolderExtension?: () => Promise<void>;
}

/**
 * Generic name that doesn’t assume “folder” as a concept.
 * Prefer this in new code.
 */
export async function initializeDefaultNodeDialogExtensions(): Promise<void> {
  await registerNodeDialogDefaults();
}

export async function initializeDefaultFolderExtensions(): Promise<void> {
  if (readRuntimeMode() !== 'production') {
    console.warn('[Deprecation] initializeDefaultFolderExtensions is deprecated. Use initializeDefaultNodeDialogExtensions instead.');
  }
  await registerNodeDialogDefaults();
}
