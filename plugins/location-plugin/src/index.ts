/**
 * Location Plugin Entry Point
 */

export { PLUGIN_MANIFEST as LocationPluginManifest } from './plugin-manifest.js';

export * from './common/types/index.js';
export { TabularQueryService as LocationTableQueryService } from '@hierarchidb/tabular-store';
export * as worker from './worker/index.js';
export * from './common/components/LocationPanel.js';
export * from './common/components/ui/SelectionMatrix.js';
export * from './common/components/steps/LocationSelectionStep.js';
export * from './common/components/batch/BatchProgressDialog.js';
export * from './common/components/batch/LocationMapPreview.js';

// Services entry (DB, batch managers, download registry, etc.)
export * from './services/index.js';

// Unified Batch Control API (API v2)
export * from './services/batch/UnifiedLocationBatchManager.js';
export { LocationBatchSessionManager } from './services/batch/BatchSessionManager.js';

