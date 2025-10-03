/**
  * @file index.ts
 * @description Styler plugin main entry point
 * : Styler
 * :
 * : HierarchiDB
  */

// Import classes and services for internal use
import { StylerDataService } from './services/StylerDataService.js';
import { StylerEntityHandler } from './handlers/StylerEntityHandler.js';
import { StylerExtension } from './extension/definition.js';
import { PLUGIN_MANIFEST } from './extension/plugin-manifest.js';

// Types exports
export type {
  StylerEntity,
  StylerStyle,
  StylerColorRule,
} from './entities/StylerEntity.js';

export type {
  StylemapCategory,
  StylemapCategoryConfig,
} from './types/category-types.js';

export type {
  StylemapBasicInfoData,
} from './steps/BasicInfoStep.js';

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
} from './types/stylerTypes.js';

// Constants and defaults
export {
  StylerConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
  MAPLIBRE_PROPERTY_GROUPS,
} from './types/stylerTypes.js';
export { PLUGIN_MANIFEST as StylerPluginManifest } from './extension/plugin-manifest.js';

// Extension definition (main plugin definition)
export { StylerExtension } from './extension/definition.js';

// Entity handler
export { StylerEntityHandler } from './handlers/StylerEntityHandler.js';

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
} from './utils/colorUtils.js';
export type {
  ColorVariationOptions,
  ColorVariations,
} from './utils/colorUtils.js';

// UI components are exported from subpath to avoid worker-time deps
// import from '@hierarchidb/plugins-styler-plugin/ui' when needed

/**
 * Backward-compatible alias for consumers that expect the historic PLUGIN_INFO export.
 * Metadata now lives in src/extension/plugin-manifest.ts.
 */
export const PLUGIN_INFO = PLUGIN_MANIFEST;

/**
  * :
 * : HierarchiDB
 * :
  */
export async function initializeStylerPlugin(context: {
  spreadsheetPlugin: any;
  csvApiDriver: any;
  nodeTypeRegistry: any;
}) {
  try {
    const { spreadsheetPlugin, csvApiDriver, nodeTypeRegistry } = context;

    //  StylerDataService
    const dataService = new StylerDataService(csvApiDriver);

    //  StylerEntityHandler
    const entityHandler = new StylerEntityHandler(spreadsheetPlugin.entityHandler, dataService);

    nodeTypeRegistry.registerExtension({
      definition: StylerExtension,
      handler: entityHandler,
      dataService,
    });

    console.log('[Styler] Plugin initialized successfully');

    return {
      definition: StylerExtension,
      handler: entityHandler,
      dataService,
    };
  } catch (error) {
    console.error('[Styler] Plugin initialization failed:', error);
    throw error;
  }
}

// Optional runtime wiring (no-op)
export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    // Styler plugin currently relies on default runtime worker lifecycle behaviour.
  }
}

// Dialog extension initializer
export { initializeStylerDialogExtension, stylerDialogExtension } from './extensions/StylerDialogExtension.js';
