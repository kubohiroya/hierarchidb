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

// Extension definition (main plugin definition)
export { StylerExtension as default } from './extension/definition.js';
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
  getContrastRatio,
} from './utils/colorUtils.js';

// UI components are exported from subpath to avoid worker-time deps
// import from '@hierarchidb/plugins-styler-plugin/ui' when needed

/**
  * : HierarchiDB
 * : package.jsonhierarchidb.plugin
 * :
  */
export const PLUGIN_INFO = {
  nodeType: 'styler',
  name: 'Styler Plugin',
  displayName: 'スタイルマップ',
  extends: 'spreadsheet',
  version: '1.0.0',
  category: 'visualization',
  priority: 700,
  capabilities: {
    canHaveChildren: false,
    canBeRoot: false,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
    canBeCopied: true,
  },
} as const;

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

    // Optionally register folder-dialog extension for evaluator/steps (if host uses folder Extensible dialog)
    // This is a no-op if the host does not consume folder extensions.
    try {
      const { stylerFolderExtension } = await import('./extensions/StylerFolderExtension.js');
      // Defer initialization; host may call separately depending on lifecycle.
      // await stylerFolderExtension.initialize();
      void stylerFolderExtension; // keep import live without side effects
    } catch {
      // ignore (folder extension optional)
    }

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
export class RuntimeWiring {}
