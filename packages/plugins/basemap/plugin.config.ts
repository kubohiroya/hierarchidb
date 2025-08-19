/**
 * BaseMapプラグイン設定
 */
import type { PluginConfig } from '@hierarchidb/worker';
import { BaseMapEntityHandler } from './src/handlers/BaseMapEntityHandler';

export const basemapPlugin: PluginConfig = {
  id: 'com.example.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  description: 'Provides basemap functionality with map rendering and tile caching',

  nodeTypes: [
    {
      type: 'basemap',
      displayName: 'Base Map',
      icon: 'map',
      color: '#4CAF50',
    },
  ],

  database: {
    tables: [
      {
        name: 'basemaps',
        storage: 'core',
        schema: '&nodeId, name, mapStyle, updatedAt',
        indexes: ['mapStyle', 'updatedAt'],
      },
      {
        name: 'basemap_workingcopies',
        storage: 'ephemeral',
        schema: '&workingCopyId, workingCopyOf, copiedAt',
        ttl: 86400000, // 24時間
      },
      {
        name: 'basemap_tiles_cache',
        storage: 'ephemeral',
        schema: '&tileId, zoom, x, y, cachedAt',
        ttl: 3600000, // 1時間
      },
    ],
  },

  dependencies: {
    required: [],
  },

  lifecycle: {
    hooks: {
      onInstall: async (_context: unknown) => {
        console.log('BaseMap plugin installed');
      },
      onEnable: async (_context: unknown) => {
        console.log('BaseMap plugin enabled');
      },
      onDisable: async (_context: unknown) => {
        console.log('BaseMap plugin disabled');
      },
      onUninstall: async (_context: unknown) => {
        console.log('BaseMap plugin uninstalled');
      },
    },
    autoStart: true,
  },

  entityHandlers: {
    basemap: new BaseMapEntityHandler(),
  },
} as const;
