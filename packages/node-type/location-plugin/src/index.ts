/**
 * Location Plugin Entry Point
 */

export * from './types';
export type { CreateLocationData } from './entities/LocationEntityHandler';
export * from './entities/LocationEntityHandler';
export * from './components/LocationDialog';
export * from './components/LocationPanel';
export * from './components/ui/SelectionMatrix';
export * from './components/steps/LocationSelectionStep';
export * from './components/batch/BatchProgressDialog';
export * from './components/batch/LocationMapPreview';

// Import and re-export the plugin definition
export { LocationPluginDefinition } from './definitions/LocationDefinition';
export { LocationPluginDefinition as default } from './definitions/LocationDefinition';

// Public API: vector tile generation service (points -> MVT)
export { LocationVectorTileService } from './services/tiles/LocationVectorTileService';
export type { LocationPointInput, LocationTileSettings, ProgressInfo } from './services/tiles/LocationVectorTileService';
export { useLocationProgress } from './hooks/useLocationProgress';
