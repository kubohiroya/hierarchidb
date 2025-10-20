/**
  * @file RuntimeWorkerService.ts
 * @description Styler plugin main entry point
 * : Styler
 * :
 * : HierarchiDB
  */

// Import manifest for legacy exports
import { PLUGIN_MANIFEST } from './plugin-manifest.js';

// Types exports
export type {
  StylerEntity,
  StylerStyle,
  StylerColorRule,
} from './common/types/StylerEntity.js';

export type {
  StylemapCategory,
  StylemapCategoryConfig,
} from './common/types/category-types.js';

export type {
  StylemapBasicInfoData,
} from './ui/components/steps/BasicInfoStep.js';

export type {
  StylerConfig,
  MapLibreStyleProperty,
  ColorAlgorithm,
  ColorSpace,
  StylerMapping,
  MapLibrePropertyMetadata,
  PropertyGroup,
  ColorCalculationResult,
  TablePreviewProps,
} from './common/types/stylerTypes.js';

// Constants and defaults
export {
  StylerConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
  MAPLIBRE_PROPERTY_GROUPS,
} from './common/types/stylerTypes.js';
export { PLUGIN_MANIFEST as StylerPluginManifest } from './plugin-manifest.js';

// Extension definition (main plugin definition)

// Entity handler
export { StylerEntityHandler } from './common/handlers/StylerEntityHandler.js';

// Services
export { StylerDataService } from './services/StylerDataService.js';

// Utilities
export {
  hsvToRgb,
  rgbToHsv,
  rgbToHex,
  hexToRgb,
  calculateLinearColor,
  calculateQuantileColor,
  generateColorGradient,
  valueToColor,
  adjustBrightness,
  createColorVariations,
  getContrastRatio,
} from './common/utils/colorUtils.js';
export type {
  ColorVariationOptions,
  ColorVariations,
} from './common/utils/colorUtils.js';

// UI components are exported from subpath to avoid worker-time deps
// import from '@hierarchidb/styler-plugin/ui' when needed

/**
 * Backward-compatible alias for consumers that expect the historic PLUGIN_INFO export.
 * Metadata now lives in src/plugin-manifest.ts.
 */
export const PLUGIN_INFO = PLUGIN_MANIFEST;

/**
  * :
 * : HierarchiDB
 * :
  */
/**
 * Legacy initializeStylerPlugin helper has been removed. Consumers should rely on
 * StylerDialogExtension / runtime registration instead of the old extension definition path.
 */

// Optional runtime wiring (no-op)
export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    // Styler plugin currently relies on default runtime worker lifecycle behaviour.
  }
}

// Dialog extension initializer
export { initializeStylerDialogExtension, stylerDialogExtension } from './common/extensions/StylerDialogExtension.js';

let initialized = false;

export async function onRegister(): Promise<void> {
  if (initialized) return;
  initialized = true;
  // Styler plugin currently has no pre-load side effects; this hook
  // exists so the runtime executes once for symmetry with other plugins.
}
