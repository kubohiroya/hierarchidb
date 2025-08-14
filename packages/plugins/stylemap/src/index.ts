/**
 * @file index.ts
 * @description Main export file for StyleMap plugin
 * Provides centralized exports for all StyleMap functionality
 */

// ==================
// Plugin Configuration
// ==================
export { stylemapPlugin, createStyleMapPlugin, validateStyleMapPlugin } from '../plugin.config';

// ==================
// Core Type Definitions
// ==================
export type {
  // Entity types
  StyleMapEntity,
  StyleMapMetadata,
  StyleMapWorkingCopy,
  StyleMapCreationData,
  StyleMapUpdateData,
  StyleMapValidationResult,

  // Configuration types
  StyleMapConfig,
  ColorMappingConfig,
  ColorMappingAlgorithm,
  ColorSpace,
  MapLibreStyleProperty,
  StylePropertyMetadata,

  // Filter types
  FilterRule,
  FilterAction,
  FilterRuleValidationResult,
  FilterRuleStats,

  // Table types
  TableMetadataEntity,
  RowEntity,
  ColumnMetadata,
  TableDataSummary,
  TableImportResult,
  TableQueryOptions,
  TableQueryResult,

  // Utility types
  StyleMapFormData,
  RGBColor,
  HSVColor,
  HexColor,
  StylePropertyValue,
  StyleGenerationResult,
  CacheKeyComponents,
  StyleCacheEntry,
  StyleMapPluginMeta,
} from './types';

// ==================
// Type Utilities and Constants
// ==================
export {
  // Entity utilities
  createStyleMapEntity,
  createStyleMapWorkingCopy,
  validateStyleMapEntity,

  // Configuration utilities
  DEFAULT_STYLEMAP_CONFIG,
  COLOR_MAPPING_PRESETS,
  MAPLIBRE_STYLE_PROPERTIES,
  validateStyleMapConfig,
  createStyleMapConfig,
  applyColorPreset,
  getStylePropertyMetadata,
  getStylePropertiesByCategory,

  // Filter utilities
  createFilterRule,
  validateFilterRule,
  createTemplateFilterRules,
  applyFilterRules,
  getColumnUniqueValues,

  // Table utilities
  createTableMetadataEntity,
  createRowEntity,
  analyzeColumnData,
  validateTableMetadata,
  createTableDataSummary,

  // Constants and enums
  STYLEMAP_CONSTANTS,
  StyleMapErrorType,
  StyleMapError,

  // Type guards
  isStyleMapEntity,
  isStyleMapConfig,
  isFilterRule,
  isTableMetadataEntity,
} from './types';

// ==================
// Database Layer
// ==================
export { StyleMapDatabase } from './database/StyleMapDatabase';
export {
  StyleMapDatabaseOptimizer,
  StyleMapDatabaseMigration,
  DEFAULT_OPTIMIZATION_CONFIG,
} from './database/StyleMapDatabaseOptimization';
export type {
  DatabaseOptimizationConfig,
  PerformanceMetrics,
} from './database/StyleMapDatabaseOptimization';

// ==================
// Handler Layer
// ==================
export { StyleMapEntityHandler } from './handlers/StyleMapEntityHandler';
export { StyleMapHandler } from './handlers/StyleMapHandler';

// ==================
// Plugin Definition
// ==================
export {
  StyleMapUnifiedDefinition,
  initializeStyleMapPlugin,
  cleanupStyleMapPlugin,
  healthCheckStyleMapPlugin,
} from './definitions/StyleMapDefinition';

// ==================
// React Components (Lazy Loaded)
// ==================
// Note: These are lazy-loaded to prevent loading React in Worker context

/**
 * Lazy-loaded React components for UI
 * Only load these in the main thread UI context
 */
export const StyleMapComponents = {
  // Main components
  get StyleMapDialog() {
    return import('./components/StyleMapDialog');
  },
  get StyleMapEditor() {
    return import('./components/StyleMapEditor');
  },
  get StyleMapForm() {
    return import('./components/StyleMapForm');
  },
  get StyleMapView() {
    return import('./components/StyleMapView');
  },
  get StyleMapPreview() {
    return import('./components/StyleMapPreview');
  },
  get StyleMapPanel() {
    return import('./components/StyleMapPanel');
  },
  get StyleMapIcon() {
    return import('./components/StyleMapIcon');
  },
  get StyleMapImport() {
    return import('./components/StyleMapImport');
  },

  // Step components
  get Step1FileUpload() {
    return import('./components/steps/Step1FileUpload');
  },
  get Step2ColumnMapping() {
    return import('./components/steps/Step2ColumnMapping');
  },
  get Step3ColorMapping() {
    return import('./components/steps/Step3ColorMapping');
  },
  get Step4Preview() {
    return import('./components/steps/Step4Preview');
  },
};

// ==================
// Utility Functions (Lazy Loaded)
// ==================
// Note: These are lazy-loaded to prevent loading large dependencies in initialization

/**
 * Lazy-loaded utility functions
 * Load these only when needed to reduce bundle size
 */
export const StyleMapUtils = {
  // File processing
  get csvParser() {
    return import('./utils/csvParser');
  },

  // Color mapping
  get colorMapping() {
    return import('./utils/colorMapping');
  },

  // Filtering
  get filterEngine() {
    return import('./utils/filterEngine');
  },

  // Hash utilities
  get hashUtils() {
    return import('./utils/hashUtils');
  },

  // Style generation
  get styleGenerator() {
    return import('./utils/styleGenerator');
  },
};

// ==================
// Plugin Information
// ==================

/**
 * Plugin information and metadata
 */
export const PLUGIN_INFO = {
  id: 'com.hierarchidb.stylemap',
  name: 'StyleMap Plugin',
  version: '1.0.0',
  description: 'CSV/TSV data to MapLibre style mapping plugin',
  author: 'hierarchidb team',

  // Capabilities
  capabilities: {
    fileFormats: ['csv', 'tsv', 'xlsx', 'xls'],
    colorAlgorithms: ['linear', 'logarithmic', 'quantile', 'categorical'],
    styleProperties: [
      'fill-color',
      'line-color',
      'circle-color',
      'text-color',
      'fill-opacity',
      'line-opacity',
      'circle-opacity',
      'line-width',
      'circle-radius',
    ],
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxRows: 1000000, // 1M rows
    maxColumns: 1000, // 1K columns
  },

  // Dependencies
  dependencies: {
    required: ['@hierarchidb/core', '@hierarchidb/worker', 'dexie'],
    optional: ['react', '@mui/material'],
  },

  // Performance characteristics
  performance: {
    memoryUsage: 'medium',
    cpuUsage: 'medium',
    diskUsage: 'low',
    networkUsage: 'none',
  },
} as const;

/**
 * Plugin feature flags
 * Use these to check available features at runtime
 */
export const PLUGIN_FEATURES = {
  // Core features
  MULTIPLE_FILE_FORMATS: true,
  REAL_TIME_PREVIEW: true,
  ADVANCED_FILTERING: true,

  // Performance features
  CACHE_OPTIMIZATION: true,
  BACKGROUND_PROCESSING: true,
  STREAMING_IMPORT: true,

  // UI features
  WORKING_COPY_SUPPORT: true,
  STEP_WISE_DIALOG: true,
  COLOR_PRESETS: true,

  // Future features (disabled)
  CUSTOM_ALGORITHMS: false,
  MACHINE_LEARNING: false,
  REAL_TIME_COLLABORATION: false,
} as const;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof PLUGIN_FEATURES): boolean {
  return PLUGIN_FEATURES[feature];
}

/**
 * Get plugin version information
 */
export function getPluginVersion(): {
  version: string;
  buildDate: string;
  gitCommit?: string;
} {
  return {
    version: PLUGIN_INFO.version,
    buildDate: new Date().toISOString(),
    // gitCommit would be injected during build
  };
}

/**
 * Plugin health check
 */
export async function checkPluginHealth(): Promise<{
  isHealthy: boolean;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details: Record<string, any>;
}> {
  try {
    // Check database connectivity
    const db = (await import('./database/StyleMapDatabase')).StyleMapDatabase.getInstance();
    await db.getDatabaseStats();

    // Check basic functionality
    const { validateStyleMapPlugin } = await import('../plugin.config');
    const validation = validateStyleMapPlugin();

    if (!validation.isValid) {
      return {
        isHealthy: false,
        status: 'error',
        message: 'Plugin configuration validation failed',
        details: { errors: validation.errors },
      };
    }

    if (validation.warnings.length > 0) {
      return {
        isHealthy: true,
        status: 'warning',
        message: 'Plugin is healthy with warnings',
        details: { warnings: validation.warnings },
      };
    }

    return {
      isHealthy: true,
      status: 'ok',
      message: 'Plugin is healthy',
      details: {},
    };
  } catch (error) {
    return {
      isHealthy: false,
      status: 'error',
      message: `Plugin health check failed: ${error}`,
      details: { error },
    };
  }
}

// ==================
// Default Export
// ==================

// Utility functions
async function initializeStyleMapPlugin(): Promise<void> {
  const db = StyleMapDatabase.getInstance();
  await db.open();
  console.log('StyleMap plugin initialized');
}

async function cleanupStyleMapPlugin(): Promise<void> {
  const db = StyleMapDatabase.getInstance();
  await db.close();
  console.log('StyleMap plugin cleaned up');
}

async function checkStyleMapHealth(): Promise<boolean> {
  try {
    const db = StyleMapDatabase.getInstance();
    if (!db.isOpen()) {
      await db.open();
    }
    return true;
  } catch (error) {
    console.error('StyleMap health check failed:', error);
    return false;
  }
}

/**
 * Default export with plugin configuration
 */
import { StyleMapEntityHandler } from './handlers/StyleMapEntityHandler';
import { StyleMapHandler } from './handlers/StyleMapHandler';
import { StyleMapDatabase } from './database/StyleMapDatabase';
import { StyleMapUnifiedDefinition } from './definitions/StyleMapDefinition';

const exportDefault: any = {
  // Plugin configuration
  // plugin: stylemapPlugin,

  // Core functionality
  StyleMapEntityHandler,
  StyleMapHandler,
  StyleMapDatabase,

  // Plugin definition
  StyleMapUnifiedDefinition,

  // Utilities
  initialize: initializeStyleMapPlugin,
  cleanup: cleanupStyleMapPlugin,
  healthCheck: checkStyleMapHealth,

  // Metadata
  info: PLUGIN_INFO,
  features: PLUGIN_FEATURES,
  version: getPluginVersion,
};

export default exportDefault;
