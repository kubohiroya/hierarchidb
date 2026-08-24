export {
  configureWorkerContainer,
  getWorkerContainer,
  resetWorkerContainerForTesting,
} from './di/container.js';
export type { PluginWorkerModuleLoaderContract } from './di/PluginWorkerModuleLoaderContract.js';
export { WorkerDiTokens } from './di/WorkerDiTokens.js';
export {
  createDexieFeatureStore,
  createDexieVectorTileStore,
} from './entity/dexie-stores.js';
export { getVTStoreRegistry } from './entity/getVTStoreRegistry.js';
// Public re-exports for plugin-side stores and registry
export type {
  FeatureItemBase,
  FeatureStore,
  RelationBase,
  RelationStore,
  VectorTileItemBase,
  VectorTileStore,
} from './entity/storeTypes.js';
export { VTStoreRegistry } from './entity/VTStoreRegistry.js';
export * from './module-paths.js';
export {
  publishBuildSessionUpdate,
  subscribeToBuildSessionBroadcast,
} from './services/buildSessionBroadcastUtils.js';
// CoreDB and draft utilities (for plugin-side usage)
export { CoreDB } from './services/CoreDB.js';
export * from './services/downloadAdapter.js';
export { commitTreeNodeDraft } from './services/draft/commitOperations.js';
export { discardTreeNodeDraft } from './services/draft/discardTreeNodeDraft.js';
export {
  getTreeNode,
  updateTreeNodeDraftData,
  updateTreeNodeDraftMetadata,
} from './services/draft/lookupOperationUtils.js';
export {
  EffectiveTreeNodeDataResolverError,
  type EffectiveTreeNodeDataResolverErrorCode,
  type EffectiveTreeNodeDataResolverInput,
  type EffectiveTreeNodeDataResolverMetadata,
  type EffectiveTreeNodeDataResolverResult,
  type EffectiveTreeNodeDataSlot,
  resolveEffectiveTreeNodeData,
  strictMergeNodePayload,
  type TreeNodeReader,
} from './services/effectiveTreeNodeDataResolver.js';
export {
  getRuntimeWorkerClient,
  hasRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
  registerRuntimeWorkerClient,
  unregisterRuntimeWorkerClient,
} from './services/RuntimeWorkerService.js';
export {
  type RuntimeWorkerAdapterOptions,
  registerPluginRuntimeWorkerAdapters,
} from './services/registerPluginRuntimeWorkerAdapters.js';
export { ShapeMutationService } from './services/ShapeMutationService.js';
export { ShapeQueryService } from './services/ShapeQueryService.js';
export {
  createStageWorkerClient,
  getStageProcessingClient,
  getStageWorkerProxy,
} from './services/StageProcessingService.js';
export {
  type ApplyStagedFolderActionOverlaysInput,
  applyStagedFolderActionOverlays,
  StagedFolderActionOverlayApplicationError,
  type StagedFolderActionOverlayApplicationErrorCode,
  type StagedFolderActionOverlayEntry,
  type StagedFolderActionOverlayStagingMode,
} from './services/stagedFolderActionOverlayService.js';
export {
  createStagedFolderActionBuildRuntimeAdapter,
  isStagedFolderActionRunActive,
  type StagedFolderActionProgressFilter,
  StagedFolderActionProgressStore,
  toBuildSessionRuntimeRecord,
} from './services/stagedFolderActionProgressStore.js';
export {
  runStagedFolderAction,
  type StagedFolderActionBuildResult,
  type StagedFolderActionPreparedStaging,
  type StagedFolderActionRunnerDependencies,
  type StagedFolderActionRunnerInput,
} from './services/stagedFolderActionRunner.js';
export { TreeQueryService } from './services/TreeQueryService.js';
export {
  assertNodeIsNotTemporaryStagingNode,
  cleanupTemporaryStagingRoot,
  createTemporaryCopyStagingRoot,
  ensureTemporaryFolderHolder,
  getTemporaryFolderNodeId,
  isNodeInTemporaryFolderSubtree,
  isTemporaryFolderHolderNode,
  refreshTemporaryFolderVisibility,
  TEMPORARY_FOLDER_NAME,
  TEMPORARY_FOLDER_NODE_TYPE,
  TEMPORARY_STAGING_NODE_ERROR,
} from './services/temporaryFolderHolderLifecycle.js';
export {
  runVectorTileStage,
  type VectorTileStageInput,
  type VectorTileStageOptions,
  type VectorTileStageResult,
  writeVectorTileInput,
} from './services/vectorTileStageRunner.js';
export { resolveDefaultNodeName } from './utils/resolveDefaultNodeName.js';
// Worker service (public API for worker bootstrap)
export { WorkerService, type WorkerServiceOptions } from './WorkerService.js';
