/**
 * UI Plugin Definition for Shape Plugin
 * Registers the Shape plugin with the UI layer
 */

import React from 'react';
import { Layers as LayersIcon } from '@mui/icons-material';
import { NodeId } from '@hierarchidb/common-core';
import type {
  UIPluginDefinition,
  CreateDialogProps,
  EditDialogProps,
} from '@hierarchidb/ui-core/src/plugins/types';
import { ShapeDialog } from './components/ShapeDialog';

/**
 * Shape Icon Component
 */
const ShapeIcon: React.FC = () => <LayersIcon />;

/**
 * Shape Panel Component (placeholder)
 */
const ShapePanel: React.FC<{ nodeId: NodeId; data: any }> = ({ nodeId, data }) => (
  <div>Shape Panel for {nodeId}</div>
);

/**
 * Shape Form Component (placeholder)
 */
const ShapeForm: React.FC<{ nodeId: string }> = ({ nodeId }) => <div>Shape Form for {nodeId}</div>;

/**
 * Shape Create Dialog Wrapper
 */
const ShapeCreateDialog: React.FC<CreateDialogProps> = ({
  parentNodeId,
  onSubmit,
  onCancel,
  open,
}) => <ShapeDialog mode="create" parentNodeId={parentNodeId} onClose={onCancel} open={!!open} />;

/**
 * Shape Edit Dialog Wrapper
 */
const ShapeEditDialog: React.FC<EditDialogProps> = ({
  nodeId,
  currentData,
  onSubmit,
  onCancel,
  open,
}) => <ShapeDialog mode="edit" nodeId={nodeId} onClose={onCancel} open={open} />;

/**
 * Shape UI Plugin Definition
 */
export const ShapeUIPlugin: UIPluginDefinition = {
  // Core identification
  nodeType: 'shape',
  displayName: 'Geographic Shapes',
  description: 'Manage geographic shape data with batch processing capabilities',

  // Component mappings
  components: {
    icon: ShapeIcon,
    createDialog: ShapeCreateDialog,
    editDialog: ShapeEditDialog,
    detailPanel: ShapePanel,
  },

  // Data source configuration
  dataSource: {
    requiresEntity: true,
    entityType: 'shape',
  },

  // Plugin capabilities
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: false,
    canMove: true,
    supportsWorkingCopy: true,
    supportsVersioning: false,
    supportsExport: true,
    supportsBulkOperations: true,
  },

  // Menu configuration
  menu: {
    group: 'advanced',
    createOrder: 25,
    contextMenuItems: [],
  },

  // Lifecycle hooks
  hooks: {
    beforeShowCreateDialog: async ({ parentNodeId, context }) => {
      console.log('Opening Shape create dialog for parent:', parentNodeId);
      return { proceed: true };
    },

    afterCreate: async ({ nodeId, data, parentNodeId }) => {
      console.log('Shape created:', nodeId, data);
      return {
        showMessage: 'Shape created successfully',
        refreshNodes: [parentNodeId],
      };
    },

    afterUpdate: async ({ nodeId, changes, updatedData }) => {
      console.log('Shape updated:', nodeId, changes);
      return {
        showMessage: 'Shape updated successfully',
        refreshNodes: [nodeId],
      };
    },

    beforeDelete: async ({ nodeIds, entities, hasChildren }) => {
      console.log('Shape deleting:', nodeIds);
      return {
        proceed: true,
        confirmMessage: `Delete ${nodeIds.length} shape(s)?`,
      };
    },

    afterDelete: async ({ deletedNodeIds, parentIds }) => {
      console.log('Shape deleted:', deletedNodeIds);
      return {
        showMessage: 'Shape deleted successfully',
        refreshNodes: parentIds,
      };
    },
  },

  // Plugin styling
  style: {
    primaryColor: '#4CAF50',
    rowStyle: {
      backgroundColor: '#E8F5E9',
    },
  },
};

/**
 * Register the Shape UI Plugin
 * Call this function during _app initialization
 */
export function registerShapeUIPlugin(): void {
  try {
    // Dynamic import to avoid circular dependencies
    import('@hierarchidb/ui-core/src/plugins/registry/UIPluginRegistry').then(
      ({ getUIPluginRegistry }) => {
        const registry = getUIPluginRegistry();
        registry.register(ShapeUIPlugin);
        console.log('Shape UI Plugin registered successfully');
      }
    );
  } catch (error) {
    console.error('Failed to register Shape UI Plugin:', error);
  }
}
