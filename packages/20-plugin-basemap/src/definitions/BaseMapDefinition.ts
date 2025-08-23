/**
 * @file BaseMapDefinition.ts
 * @description PluginDefinition for BaseMap plugin
 * References: docs/7-aop-architecture.md
 */

// import { lazy } from 'react';
import type { TreeNodeType, NodeId, TreeNode } from '@hierarchidb/00-core';
import type {
  NodeTypeDefinition,
  NodeLifecycleHooks,
  IconDefinition,
} from '@hierarchidb/00-core';
import { validateNodeName, validateNodeDescription } from '@hierarchidb/00-core';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import { BaseMapHandler } from '../handlers/BaseMapHandler';
import { BaseMapDatabase } from '../database/BaseMapDatabase';

/**
 * Lifecycle hooks for BaseMap nodes
 */
const baseMapLifecycle: NodeLifecycleHooks<BaseMapEntity, BaseMapWorkingCopy> = {
  // Before create hook - validate map configuration
  beforeCreate: async (_parentId: NodeId, nodeData: Partial<TreeNode>) => {
    const mapData = nodeData as Partial<BaseMapEntity>;
    // Validate common node properties first
    if (nodeData.name !== undefined) {
      const nameValidation = validateNodeName(nodeData.name);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.error || 'Invalid node name');
      }
    }
    
    if (nodeData.description !== undefined) {
      const descValidation = validateNodeDescription(nodeData.description);
      if (!descValidation.isValid) {
        throw new Error(descValidation.error || 'Invalid node description');
      }
    }
    
    // Validate center coordinates
    if (mapData.center) {
      const [lng, lat] = mapData.center;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(
          'Invalid coordinates: longitude must be between -180 and 180, latitude between -90 and 90'
        );
      }
    }

    // Validate zoom level
    if (mapData.zoom !== undefined) {
      if (mapData.zoom < 0 || mapData.zoom > 22) {
        throw new Error('Invalid zoom level: must be between 0 and 22');
      }
    }

    // Validate bearing
    if (mapData.bearing !== undefined) {
      if (mapData.bearing < 0 || mapData.bearing > 360) {
        throw new Error('Invalid bearing: must be between 0 and 360');
      }
    }

    // Validate pitch
    if (mapData.pitch !== undefined) {
      if (mapData.pitch < 0 || mapData.pitch > 60) {
        throw new Error('Invalid pitch: must be between 0 and 60');
      }
    }
  },

  // After create hook - initialize map resources
  afterCreate: async (nodeId: NodeId, entity: BaseMapEntity) => {
    // Log creation for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap created: ${nodeId} - ${entity.name}`);
    }

    // Initialize any external resources if needed
    // For example, pre-fetch map tiles, validate API keys, etc.
  },

  // Before update hook - validate changes
  beforeUpdate: async (_nodeId: NodeId, changes: Partial<TreeNode>) => {
    // Validate node name changes if present
    if (changes.name !== undefined) {
      const nameValidation = validateNodeName(changes.name);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.error || 'Invalid node name');
      }
    }
  },

  // After update hook - refresh map resources
  afterUpdate: async (nodeId: NodeId, _entity: BaseMapEntity) => {
    // Refresh any cached resources if needed
    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap updated: ${nodeId}`);
    }
  },

  // Before delete hook - cleanup preparation
  beforeDelete: async (nodeId: NodeId) => {
    // Prepare for cleanup
    if (process.env.NODE_ENV === 'development') {
      console.log(`Preparing to delete BaseMap: ${nodeId}`);
    }
  },

  // After delete hook - cleanup resources
  afterDelete: async (nodeId: NodeId) => {
    // Clean up any external resources
    // For example, clear cached tiles, cancel pending requests, etc.
    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap deleted: ${nodeId}`);
    }
  },
};

/**
 * Router actions for BaseMap plugin
 */
// const baseMapRouterActions = {
//   actions: {
//     // view: {
//     //   component: lazy(() => import('../containers/BaseMapView')),
//     //   path: 'view'
//     // },
//     edit: {
//       component: lazy(() => import('../components/BaseMapEditor')),
//       path: 'edit',
//     },
//     preview: {
//       component: lazy(() => import('../components/BaseMapPreview')),
//       path: 'preview',
//     },
//   } as Record<string, WorkerPluginRouterAction>,
// };

/**
 * Icon definition for BaseMap plugin
 * Provides multiple formats for different UI contexts
 */
const baseMapIcon: IconDefinition = {
  // MUI icon name (priority)
  muiIconName: 'Map',
  
  // Unicode emoji fallback
  emoji: '🗺️',
  
  // Custom SVG icon
  svg: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
  </svg>`,
  
  // SVG path for icon libraries
  svgPath: 'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z',
  
  // Icon description for accessibility and UI display
  description: 'Base Map - Configure and manage map layers with various styles and visualization options',
  
  // Theme color
  color: '#1976d2'
};

/**
 * BaseMap Unified Plugin Definition
 * Complete definition for the BaseMap plugin
 */
export const BaseMapUnifiedDefinition: NodeTypeDefinition<
  BaseMapEntity,
  never, // No sub-entities
  BaseMapWorkingCopy
> = {
  // Node type identification
  nodeType: 'basemap' as TreeNodeType,
  name: 'BaseMap',
  displayName: 'Base Map',
  
  // Icon configuration
  icon: baseMapIcon.muiIconName,
  color: baseMapIcon.color,

  // Database configuration
  database: {
    entityStore: 'basemaps',
    schema: {
      basemaps: '&id, nodeId, name, mapStyle, createdAt, updatedAt',
    },
    version: 1,
  },

  // Entity handler
  entityHandler: new BaseMapHandler(),

  // Lifecycle hooks
  lifecycle: baseMapLifecycle,


};

/**
 * Plugin initialization function
 * Call this to register the BaseMap plugin
 */
export async function initializeBaseMapPlugin(): Promise<void> {
  // Initialize database
  const db = BaseMapDatabase.getInstance();
  await db.open();

  // Additional initialization if needed
  if (process.env.NODE_ENV === 'development') {
    console.log('BaseMap plugin initialized');
  }
}

/**
 * Plugin cleanup function
 * Call this to cleanup BaseMap plugin resources
 */
export async function cleanupBaseMapPlugin(): Promise<void> {
  // Close database connection
  await BaseMapDatabase.close();

  // Additional cleanup if needed
  if (process.env.NODE_ENV === 'development') {
    console.log('BaseMap plugin cleaned up');
  }
}
