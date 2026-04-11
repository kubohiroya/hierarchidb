export {
  configureWorkerContainer,
  getWorkerContainer,
  resetWorkerContainerForTesting,
} from './di/container.js';
export type { PluginWorkerModuleLoaderContract } from './di/PluginWorkerModuleLoaderContract.js';
export { WorkerDiTokens } from './di/WorkerDiTokens.js';
// Public re-exports for plugin-side stores and registry
export type {
  FeatureItemBase,
  FeatureStore,
  RelationBase,
  RelationStore,
  VectorTileItemBase,
  VectorTileStore,
} from './entity/storeTypes.js';
export {
  createDexieFeatureStore,
  createDexieVectorTileStore,
} from './entity/dexie-stores.js';
export * from './module-paths.js';
// CoreDB and draft utilities (for plugin-side usage)
export { CoreDB } from './services/CoreDB.js';
export * from './services/downloadAdapter.js';
export { discardTreeNodeDraft } from './services/draft/discardTreeNodeDraft.js';
export { commitTreeNodeDraft } from './services/draft/commitOperations.js';
export {
  getTreeNode,
  updateTreeNodeDraftData,
  updateTreeNodeDraftMetadata,
} from './services/draft/lookupOperations.js';
export {
  type RuntimeWorkerAdapterOptions,
  registerPluginRuntimeWorkerAdapters,
} from './services/registerPluginRuntimeWorkerAdapters.js';
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
  getStageProcessingClient,
  getStageWorkerProxy,
} from './services/StageProcessingService.js';
export { TreeQueryService } from './services/TreeQueryService.js';
export {
  runVectorTileStage,
  type VectorTileStageInput,
  type VectorTileStageOptions,
  type VectorTileStageResult,
  writeVectorTileInput,
} from './services/vectorTileStageRunner.js';
export { resolveDefaultNodeName } from './utils/resolveDefaultNodeName.js';
export { ShapeMutationService } from './services/ShapeMutationService.js';
export { publishBuildSessionUpdate, subscribeToBuildSessionBroadcast } from './services/buildSessionBroadcast.js';
export { ShapeQueryService } from './services/ShapeQueryService.js';
// Worker service (public API for worker bootstrap)
export { WorkerService } from './WorkerService.js';
