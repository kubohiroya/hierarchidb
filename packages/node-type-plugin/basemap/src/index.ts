/**
 * BaseMap Plugin - Main exports
 * Integrates 3-layer architecture (shared/ui/worker)
 */

// Shared layer exports (types, constants, utilities)
export type { 
  BaseMapAPI,
  BaseMapEntity,
  BaseMapWorkingCopy,
  CreateBaseMapData,
  UpdateBaseMapData,
  MapViewportState,
  BaseMapDisplayOptions,
  BaseMapValidationResult,
  BaseMapStatistics,
  MapLibreStyleConfig
} from './shared';

export { 
  DEFAULT_MAP_CONFIG,
  MAP_STYLE_PRESETS,
  VALIDATION_LIMITS,
  validateCreateBaseMapData,
  validateUpdateBaseMapData,
  validateCreateBaseMapDataStrict,
  validateUpdateBaseMapDataStrict,
  BaseMapErrorFactory
} from './shared';

export { BaseMapMetadata } from './shared';

// UI layer exports (for browser/main thread)
export { 
  BaseMapUIPlugin,
  BaseMapDialogContainer,
  BaseMapForm,
  BaseMapPreview,
  BaseMapIcon,
  BaseMapPanel,
  useBaseMapAPI,
  useBaseMapData,
  useBaseMapValidation
} from './ui';

// Worker layer exports (for web worker thread)  
export {
  BaseMapWorkerPlugin,
  basemapPluginAPI,
  BaseMapEntityHandler,
  BaseMapDatabaseConfig
} from './worker';

// Plugin information
export const PLUGIN_INFO = {
  id: 'com.hierarchidb.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  architecture: '3-layer',
} as const;