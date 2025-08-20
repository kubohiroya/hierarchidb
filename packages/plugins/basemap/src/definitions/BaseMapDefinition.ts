/**
 * @file BaseMapDefinition.ts
 * @description UnifiedPluginDefinition for BaseMap plugin
 * References: docs/7-aop-architecture.md
 */

import { lazy } from 'react';
import type { TreeNodeType, TreeNodeId } from '@hierarchidb/core';
import type {
  UnifiedPluginDefinition,
  NodeLifecycleHooks,
  WorkerPluginRouterAction,
  IconDefinition,
} from '@hierarchidb/worker/registry';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import { BaseMapHandler } from '../handlers/BaseMapHandler';
import { BaseMapDatabase } from '../database/BaseMapDatabase';

/**
 * Lifecycle hooks for BaseMap nodes
 */
const baseMapLifecycle: NodeLifecycleHooks<BaseMapEntity, BaseMapWorkingCopy> = {
  // Before create hook - validate map configuration
  beforeCreate: async (_parentId: TreeNodeId, nodeData: Partial<any>) => {
    // Validate center coordinates
    if (nodeData.center) {
      const [lng, lat] = nodeData.center;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(
          'Invalid coordinates: longitude must be between -180 and 180, latitude between -90 and 90'
        );
      }
    }

    // Validate zoom level
    if (nodeData.zoom !== undefined) {
      if (nodeData.zoom < 0 || nodeData.zoom > 22) {
        throw new Error('Invalid zoom level: must be between 0 and 22');
      }
    }

    // Validate bearing
    if (nodeData.bearing !== undefined) {
      if (nodeData.bearing < 0 || nodeData.bearing > 360) {
        throw new Error('Invalid bearing: must be between 0 and 360');
      }
    }

    // Validate pitch
    if (nodeData.pitch !== undefined) {
      if (nodeData.pitch < 0 || nodeData.pitch > 60) {
        throw new Error('Invalid pitch: must be between 0 and 60');
      }
    }
  },

  // After create hook - initialize map resources
  afterCreate: async (nodeId: TreeNodeId, entity: BaseMapEntity) => {
    // Log creation for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap created: ${nodeId} - ${entity.name}`);
    }

    // Initialize any external resources if needed
    // For example, pre-fetch map tiles, validate API keys, etc.
  },

  // Before update hook - validate changes
  beforeUpdate: async (_nodeId: TreeNodeId, changes: Partial<any>) => {
    // Validate coordinate changes
    if (changes.center) {
      const [lng, lat] = changes.center;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error('Invalid coordinates in update');
      }
    }
  },

  // After update hook - refresh map resources
  afterUpdate: async (nodeId: TreeNodeId, _entity: BaseMapEntity) => {
    // Refresh any cached resources if needed
    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap updated: ${nodeId}`);
    }
  },

  // Before delete hook - cleanup preparation
  beforeDelete: async (nodeId: TreeNodeId) => {
    // Prepare for cleanup
    if (process.env.NODE_ENV === 'development') {
      console.log(`Preparing to delete BaseMap: ${nodeId}`);
    }
  },

  // After delete hook - cleanup resources
  afterDelete: async (nodeId: TreeNodeId) => {
    // Clean up any external resources
    // For example, clear cached tiles, cancel pending requests, etc.
    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap deleted: ${nodeId}`);
    }
  },

  // Before commit hook - validate working copy
  beforeCommit: async (_nodeId: TreeNodeId, workingCopy: BaseMapWorkingCopy) => {
    // Validate working copy before committing
    if (!workingCopy.isDirty) {
      console.warn('Committing working copy with no changes');
    }
  },

  // After commit hook - update map display
  afterCommit: async (nodeId: TreeNodeId, _entity: BaseMapEntity) => {
    // Trigger map refresh in UI
    if (process.env.NODE_ENV === 'development') {
      console.log(`Working copy committed for BaseMap: ${nodeId}`);
    }
  },
};

/**
 * Router actions for BaseMap plugin
 */
const baseMapRouterActions = {
  actions: {
    // view: {
    //   component: lazy(() => import('../components/BaseMapView')),
    //   path: 'view'
    // },
    edit: {
      component: lazy(() => import('../components/BaseMapEditor')),
      path: 'edit',
    },
    preview: {
      component: lazy(() => import('../components/BaseMapPreview')),
      path: 'preview',
    },
  } as Record<string, WorkerPluginRouterAction>,
};

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
export const BaseMapUnifiedDefinition: UnifiedPluginDefinition<
  BaseMapEntity,
  never, // No sub-entities
  BaseMapWorkingCopy
> = {
  // Node type identification
  nodeType: 'basemap' as TreeNodeType,
  name: 'BaseMap',
  displayName: 'Base Map',
  
  // Icon configuration
  icon: baseMapIcon,
  
  // i18n configuration
  i18n: {
    namespace: 'plugin-basemap',
    defaultLocale: 'en',
    localesPath: '/plugins/basemap/locales/{{lng}}/core.json',
  },

  // Database configuration
  database: {
    dbName: 'BaseMapDB',
    tableName: 'entities',
    schema: 'nodeId, name, mapStyle, createdAt, updatedAt',
    version: 1,
  },

  // Entity handler
  entityHandler: new BaseMapHandler(),

  // Lifecycle hooks
  lifecycle: baseMapLifecycle,

  // UI configuration
  ui: {
    // These components will be implemented separately
    dialogComponentPath: '../components/BaseMapDialog',
    panelComponentPath: '../components/BaseMapPanel',
    formComponentPath: '../components/BaseMapForm',
    iconComponentPath: '../components/BaseMapIcon',
  },

  // API extensions
  api: {
    workerExtensions: {
      // Custom worker API methods for BaseMap
      exportMapStyle: async (nodeId: TreeNodeId): Promise<any> => {
        const handler = new BaseMapHandler();
        const entity = await handler.getEntity(nodeId);
        return entity?.styleConfig;
      },

      importMapStyle: async (nodeId: TreeNodeId, styleConfig: any): Promise<void> => {
        const handler = new BaseMapHandler();
        await handler.updateEntity(nodeId, { styleConfig });
      },

      getMapBounds: async (nodeId: TreeNodeId): Promise<any> => {
        const handler = new BaseMapHandler();
        const entity = await handler.getEntity(nodeId);
        return entity?.bounds;
      },
    },

    clientExtensions: {
      // Client-side API extensions would go here
    },
  },

  // Validation rules
  validation: {
    namePattern: /^[a-zA-Z0-9\s\-_]+$/,
    maxChildren: 0, // BaseMap nodes don't have children
    allowedChildTypes: [],
    customValidators: [
      {
        name: 'validCoordinates',
        validate: async (entity: BaseMapEntity) => {
          const [lng, lat] = entity.center;
          if (lng < -180 || lng > 180) {
            return 'Longitude must be between -180 and 180';
          }
          if (lat < -90 || lat > 90) {
            return 'Latitude must be between -90 and 90';
          }
          return true;
        },
      },
      {
        name: 'validZoom',
        validate: async (entity: BaseMapEntity) => {
          if (entity.zoom < 0 || entity.zoom > 22) {
            return 'Zoom level must be between 0 and 22';
          }
          return true;
        },
      },
      {
        name: 'validStyle',
        validate: async (entity: BaseMapEntity) => {
          const validStyles = ['streets', 'satellite', 'hybrid', 'terrain', 'custom'];
          if (!validStyles.includes(entity.mapStyle)) {
            return `Map style must be one of: ${validStyles.join(', ')}`;
          }
          if (entity.mapStyle === 'custom' && !entity.styleUrl && !entity.styleConfig) {
            return 'Custom style requires either styleUrl or styleConfig';
          }
          return true;
        },
      },
    ],
  },

  // React Router v7 routing configuration
  routing: baseMapRouterActions,

  // Plugin metadata
  meta: {
    version: '1.0.0',
    description: 'Base map configuration and management plugin for hierarchidb',
    author: 'hierarchidb team',
    tags: ['map', 'basemap', 'maplibre', 'visualization', 'resources'],
    dependencies: [], // No dependencies for base plugin
  },
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
