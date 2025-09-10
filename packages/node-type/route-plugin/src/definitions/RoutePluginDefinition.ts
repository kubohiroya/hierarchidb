/**
 * @file RoutePluginDefinition.ts
 * @description Route plugin definition aligned with Shape plugin's completed design
 */

import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import { RouteDialog } from '../components/RouteDialog';
import { RoutePanel } from '../components/RoutePanel';
import { RouteEntityHandler } from '../entities/RouteEntityHandler';
import { createRouteBatchManager } from '../services/UnifiedRouteBatchManager';

export const RoutePluginDefinition: any = {
  nodeType: 'route' as NodeType,
  nodeTypeDisplayName: 'Route',
  nodeTypeDescription: 'Transportation routes and networks with unified batch control',
  nodeTypeIcon: 'AltRoute',

  database: {
    entityStore: 'routes',
    workingCopyStore: 'routeWorkingCopies',
    schema: {
      routes: '&id, nodeId, [nodeId+name], createdAt, updatedAt, transportMode, generationMethod',
      routeWorkingCopies: '&id, nodeId, isDraft, createdAt, updatedAt, originalVersion',
    },
    version: 1,
  },

  // Instantiate concrete handler/manager at definition time
  entityHandler: new RouteEntityHandler(),
  batchManager: createRouteBatchManager(),

  lifecycle: {
    async onCreate(nodeId: NodeId): Promise<void> {
      console.log(`[RoutePlugin] Creating route node: ${nodeId}`);
    },

    async afterCreate(node: TreeNode): Promise<void> {
      console.log(`[RoutePlugin] Created route node: ${node.id}`);
    },

    async beforeDelete(node: TreeNode): Promise<void> {
      console.log(`[RoutePlugin] Deleting route node: ${node.id}`);
    },

    async afterUpdate(node: TreeNode): Promise<void> {
      console.log(`[RoutePlugin] Updated route node: ${node.id}`);
    },
  },

  ui: {
    dialogComponent: RouteDialog,
    panelComponent: RoutePanel,
    config: {
      showInCreateMenu: true,
      createMenuLabel: 'Route',
      createMenuIcon: 'AltRoute',
      createMenuCategory: 'transport',
      panelPosition: 'right',
    },
  },

  capabilities: {
    supportsBatchProcessing: true,
    supportsWorkingCopy: true,
    supportsRelationalData: true,
    supportsMetadata: true,
    supportsCustomFields: true,
    supportsExport: true,
    supportsImport: true,
    supportsVisualization: true,
    visualizationTypes: ['line', 'animated'],
  },

  metadata: {
    version: '1.0.0',
    author: 'HierarchiDB Team',
    license: 'MIT',
    tags: ['transportation', 'route', 'batch', 'vector'],
  },
};

export default RoutePluginDefinition;

