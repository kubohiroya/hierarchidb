// Handlers
/*
export { BaseEntityHandler } from './handlers/BaseEntityHandler.js';
export { HierarchicalEntityHandler } from './handlers/HierarchicalEntityHandler.js';
export type {
  HierarchicalEntity,
  HierarchicalSearchCriteria,
  TreeNode,
} from './handlers/HierarchicalEntityHandler.js';
*/

/*
export {
  DialogService,
} from './draft/service.ts';
export type {
  DialogState,
  StepCapabilitiesState,
} from './draft/service.ts';

 */
/*
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
 */

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
//export { PluginExtensionRegistry } from './extensions/PluginExtensionRegistry.js';

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
