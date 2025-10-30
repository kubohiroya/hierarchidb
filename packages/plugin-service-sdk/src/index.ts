// Handlers
export { BaseEntityHandler } from './handlers/BaseEntityHandler.js';
export { HierarchicalEntityHandler } from './handlers/HierarchicalEntityHandler.js';
export type {
  HierarchicalEntity,
  HierarchicalSearchCriteria,
  TreeNode,
} from './handlers/HierarchicalEntityHandler.js';

// Working copy helpers
export {
  createDraftWorkingCopyBase,
  markWorkingCopyUpdated,
} from './working-copy/helpers.js';
export type { EntityWorkingCopyAdapter } from './working-copy/adapter.js';
export { createEntityWorkingCopyAdapter } from './working-copy/adapter.js';

// Peer store helpers
export { createPeerStoreNormalizer } from './peer-store/normalizer.js';

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
