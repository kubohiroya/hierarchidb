/**
 * Location Plugin Entry Point
 */

export * from './types';
export type { CreateLocationData } from './entities/LocationEntityHandler';
export * from './entities/LocationEntityHandler';
export { TabularQueryService as LocationTableQueryService } from '@hierarchidb/tabular-store';
export * from './components/LocationDialog';
export * from './components/LocationPanel';
export * from './components/ui/SelectionMatrix';
export * from './components/steps/LocationSelectionStep';
export * from './components/batch/BatchProgressDialog';
export * from './components/batch/LocationMapPreview';

// Unified Batch Control API (API v2)
export * from './services/batch/UnifiedLocationBatchManager';
export { LocationBatchSessionManager } from './services/batch/BatchSessionManager';
export { registerLocationRuntimeWorkerAdapters } from './services/batch/adapters/registerRuntimeWorker';
export { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults, registerLocationAuthNotifier } from './services/download/registry';
export { registerLocationSharedDownloadService } from './services/download/registerSharedDownloadService';

// Import and re-export the plugin definition
export { LocationPluginDefinition } from './definitions/LocationDefinition';
export { LocationPluginDefinition as default } from './definitions/LocationDefinition';
