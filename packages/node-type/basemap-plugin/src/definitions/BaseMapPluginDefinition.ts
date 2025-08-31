/**
 * @file BaseMapPluginDefinition.ts
 * @description BaseMap plugin definition extending folder plugin
 */

import { PluginDefinition } from '@hierarchidb/common-type';
import { BaseMapEntityHandler } from '../handlers/BaseMapEntityHandler';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';

/**
 * BaseMap Plugin Definition
 * Extends folder plugin with map-specific functionality
 */
export const BaseMapPluginDefinition: PluginDefinition<BaseMapEntity, BaseMapWorkingCopy> = {
  // Basic metadata
  nodeType: 'basemap',
  name: 'BaseMap Plugin',
  displayName: 'ベースマップ',
  description: 'Geographic base layer configuration and management',
  version: '1.0.0',

  // Extension configuration
  extends: 'folder',

  // Handler instance
  handler: new BaseMapEntityHandler(),

  // Icon and UI
  icon: 'Map',
  color: '#4285F4',

  // Capabilities
  capabilities: {
    canHaveChildren: true,
    canBeRoot: false,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
    canBeCopied: true,
    supportsWorkingCopy: true,
    supportsVersioning: true,
  },

  // Category settings
  category: {
    primary: 'geographic',
    secondary: 'visualization',
    tags: ['map', 'gis', 'geographic', 'spatial'],
  },

  // UI Components
  components: {
    display: 'BaseMapDisplay',
    preview: 'BaseMapPreview',
    editor: 'BaseMapPanel',
    icon: 'MapIcon',
  },

  // Dialog steps for creation/editing
  dialogSteps: [
    {
      id: 'basic',
      title: '基本情報',
      component: 'BasicInfoStep',
      required: true,
    },
    {
      id: 'mapStyle',
      title: 'マップスタイル',
      component: 'MapStyleStep',
      required: true,
    },
    {
      id: 'viewport',
      title: 'ビューポート設定',
      component: 'MapViewportStep',
      required: true,
    },
    {
      id: 'displayOptions',
      title: '表示オプション',
      component: 'DisplayOptionsStep',
      required: false,
    },
    {
      id: 'preview',
      title: 'プレビュー',
      component: 'PreviewStep',
      required: false,
    },
  ],

  // Default values
  defaults: {
    mapStyle: {
      style: 'streets',
    },
    viewport: {
      center: [139.6917, 35.6895], // Tokyo
      zoom: 10,
      bearing: 0,
      pitch: 0,
    },
    displayOptions: {
      show3dBuildings: false,
      showTraffic: false,
      showTransit: false,
      showTerrain: false,
      showLabels: true,
    },
  },

  // Validation rules
  validation: {
    name: {
      required: true,
      minLength: 1,
      maxLength: 255,
    },
    custom: {
      viewport: (viewport: any) => {
        if (!viewport) return { valid: false, message: 'Viewport is required' };

        const { center, zoom } = viewport;
        if (!Array.isArray(center) || center.length !== 2) {
          return { valid: false, message: 'Invalid center coordinates' };
        }

        const [lng, lat] = center;
        if (lng < -180 || lng > 180) {
          return { valid: false, message: 'Longitude must be between -180 and 180' };
        }
        if (lat < -90 || lat > 90) {
          return { valid: false, message: 'Latitude must be between -90 and 90' };
        }
        if (zoom < 0 || zoom > 24) {
          return { valid: false, message: 'Zoom must be between 0 and 24' };
        }

        return { valid: true };
      },
    },
  },

  // Export/Import configuration
  exportConfig: {
    includeChildren: true,
    format: 'json',
    fields: ['name', 'description', 'mapStyle', 'viewport', 'displayOptions'],
  },

  // Search configuration
  searchConfig: {
    searchableFields: ['name', 'description', 'mapStyle.style'],
    sortableFields: ['name', 'createdAt', 'updatedAt'],
  },

  // Permission settings
  permissions: {
    create: ['admin', 'editor'],
    read: ['admin', 'editor', 'viewer'],
    update: ['admin', 'editor'],
    delete: ['admin'],
  },
};
