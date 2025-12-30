export {
  configureWorkerContainer,
  getWorkerContainer,
  resetWorkerContainerForTesting,
} from './di/container.js';
export type { PluginWorkerModuleLoaderContract } from './di/PluginWorkerModuleLoaderContract.js';
export { WorkerDiTokens } from './di/tokens.js';
export { resolveDefaultNodeName } from './utils/default-node-name.js';

// Public re-exports for plugin-side stores and registry
export type {
  FeatureItemBase,
  FeatureStore,
  RelationBase,
  RelationStore,
  VectorTileItemBase,
  VectorTileStore,
} from './entity/store.js';
export { storeRegistry } from './entity/store-registry.js';
export * from './module-paths.js';
export * from './services/downloadAdapter.js';
export {
  getRuntimeWorkerClient,
  hasRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
  registerRuntimeWorkerClient,
  unregisterRuntimeWorkerClient,
} from './services/RuntimeWorkerService.js';
export {
  createStageWorkerClient,
  getStageWorkerProxy,
  getStageProcessingClient,
} from './services/StageProcessingService.js';
export {
  runVectorTileStage,
  writeVectorTileInput,
  type VectorTileStageInput,
  type VectorTileStageOptions,
  type VectorTileStageResult,
} from './services/vectorTileStageRunner.js';
export {
  registerPluginRuntimeWorkerAdapters,
  type RuntimeWorkerAdapterOptions,
} from './services/pluginRuntimeWorkerAdapters.js';
// Worker service (public API for worker bootstrap)
export { WorkerService } from './WorkerService.js';
// CoreDB and draft utilities (for plugin-side usage)
export { CoreDB } from './services/CoreDB.js';
export { TreeQueryService } from './services/TreeQueryService.js';
export { commitTreeNodeDraft } from './services/draft/commitOperations.js';
export { discardTreeNodeDraft } from './services/draft/cleanupOperations.js';
export {
  getTreeNode,
  updateTreeNodeDraftData,
  updateTreeNodeDraftMetadata,
} from './services/draft/lookupOperations.js';
