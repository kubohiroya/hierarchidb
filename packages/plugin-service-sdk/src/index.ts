// Handlers
export { BaseEntityHandler } from './handlers/BaseEntityHandler.js';
export { HierarchicalEntityHandler } from './handlers/HierarchicalEntityHandler.js';
export type {
  HierarchicalEntity,
  HierarchicalSearchCriteria,
  TreeNode,
} from './handlers/HierarchicalEntityHandler.js';

// Working copy helpers removed (TreeNode draft lifecycle is handled by runtime-worker)
export type { EntityDraftAdapter } from './draft/adapter.js';
export { createEntityDraftAdapter } from './draft/adapter.js';
export {
  DraftService,
} from './draft/service.js';
export type {
  DraftState,
  StepCapabilitiesState,
} from './draft/service.js';

// Peer store helpers
// Plugin definitions and metadata
export const BasePluginDefinition = {
  nodeType: 'base',
  name: 'Base Node',
  displayName: 'Base Node (for inheritance)',
  description: 'Base plugin for inheritance only - not displayed in UI',
  visibility: {
    showInCreateMenu: false,
    showInPluginList: false,
  },
};

// Download helpers
export {
  createDownloadService,
  downloadWithService,
} from './download.js';
export type {
  DownloadServiceHandle,
  DownloadTaskOptions,
  ManagedDownloadOutcome,
} from './download.js';

// Plugin registry API types
export { PluginExtensionRegistry } from './extensions/PluginExtensionRegistry.js';

// Worker bridge utilities
export {
  getWorkerBridge,
  __setWorkerBridgeClientRef,
  __getWorkerBridgeClientRef,
  ensureWorkerAPI,
} from './worker/bridge.js';
export type { WorkerBridge } from './worker/bridge.js';
export {
  createComlinkEventBridge,
} from './worker/comlinkEventBridge.js';
export type {
  ComlinkEventBridge,
  ComlinkEventBridgeOptions,
  EventListener,
  RemoteEventListener,
  PhaseEvent,
  PhaseEventMap,
} from './worker/comlinkEventBridge.js';
