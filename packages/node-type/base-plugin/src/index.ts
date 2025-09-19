/**
 * @file index.ts
 * @description Base plugin for inheritance - not displayed in UI
 */

// Export handlers
export { BaseEntityHandler } from './handlers/BaseEntityHandler.js';
export { HierarchicalEntityHandler } from './handlers/HierarchicalEntityHandler.js';
export type { HierarchicalEntity, HierarchicalSearchCriteria, TreeNode } from './handlers/HierarchicalEntityHandler.js';

// Export types
export type {
  BaseSearchCriteria,
  PaginatedResult,
  EntityLifecycleHooks,
  OperationResult,
} from './types.js';

// Plugin definition (for inheritance only)
export const BasePluginDefinition = {
  nodeType: 'base',
  name: 'Base Node',
  displayName: 'Base Node (for inheritance)',
  description: 'Base plugin for inheritance only - not displayed in UI',
  visibility: {
    showInCreateMenu: false,  // Not shown in create menu
    showInPluginList: false,   // Not shown in plugin list
  },
};

// Optional runtime wiring (no-op for base plugin)
export const runtimeWiring = {} as const;
