/**
 * @file plugin.config.ts
 * @description StyleMap plugin configuration for hierarchidb
 * Defines plugin metadata, database schema, and integration settings
 * References:
 * - packages/plugins/basemap/plugin.config.ts
 * - docs/spec/plugin-stylemap-requirements.md
 */

import type { PluginConfig } from '@hierarchidb/worker/plugin';
import { StyleMapEntityHandler } from './src/handlers/StyleMapEntityHandler';

/**
 * StyleMap plugin configuration
 * Integrates CSV/TSV data processing with MapLibre style generation
 */
export const stylemapPlugin: PluginConfig = {
  // Basic plugin identification
  id: 'com.hierarchidb.stylemap',
  name: 'StyleMap Plugin',
  version: '1.0.0',

  // Node type definitions
  nodeTypes: [
    {
      type: 'stylemap',
      displayName: 'Style Map',
      icon: 'palette',
      color: '#FF5722', // Deep orange color for StyleMap nodes
    },
  ],

  // Database schema configuration
  database: {
    tables: [
      // Main StyleMap entities
      {
        name: 'stylemaps',
        storage: 'core',
        schema:
          '&nodeId, filename, [keyColumn+valueColumn], tableMetadataId, cacheKey, [updatedAt+nodeId]',
        indexes: [
          'filename',
          'keyColumn',
          'valueColumn',
          'tableMetadataId',
          'cacheKey',
          'updatedAt',
        ],
      },

      // Working copies (ephemeral storage)
      {
        name: 'stylemap_workingcopies',
        storage: 'ephemeral',
        schema: '&workingCopyId, nodeId, workingCopyOf, [copiedAt+isDirty], [nodeId+isDirty]',
        indexes: ['nodeId', 'workingCopyOf', 'copiedAt', 'isDirty'],
        ttl: 86400000, // 24 hours
      },

      // Table metadata (normalized design)
      {
        name: 'stylemap_tables',
        storage: 'core',
        schema:
          '&tableId, nodeId, filename, contentHash, [nodeId+importedAt], [lastAccessedAt+fileSize]',
        indexes: ['nodeId', 'filename', 'contentHash', 'importedAt', 'lastAccessedAt'],
      },

      // Table row data
      {
        name: 'stylemap_rows',
        storage: 'core',
        schema: '&rowId, tableId, [tableId+rowIndex], rowIndex',
        indexes: ['tableId', 'rowIndex'],
      },

      // Style generation cache
      {
        name: 'stylemap_cache',
        storage: 'ephemeral',
        schema: '&cacheKey, [cachedAt+expiresAt], [expiresAt+hitCount]',
        indexes: ['cachedAt', 'expiresAt', 'hitCount'],
        ttl: 3600000, // 1 hour
      },
    ],
  },

  // Plugin dependencies
  dependencies: {
    required: ['@hierarchidb/core', '@hierarchidb/worker', 'dexie'],
  },

  // Lifecycle management
  lifecycle: {
    hooks: {
      // Plugin installation
      onInstall: async (_context) => {
        console.log('StyleMap plugin installing...');

        // Initialize database tables
        const { StyleMapDatabase } = await import('./src/database/StyleMapDatabase');
        const db = StyleMapDatabase.getInstance();
        await db.open();

        console.log('StyleMap plugin installed successfully');
      },

      // Plugin activation
      onEnable: async (_context) => {
        console.log('StyleMap plugin enabled');

        // Start background optimization if configured
        // const { StyleMapDatabaseOptimizer } = await import('./src/database/StyleMapDatabaseOptimization');
        // Note: In production, this would be managed by the plugin system
      },

      // Plugin deactivation
      onDisable: async (_context) => {
        console.log('StyleMap plugin disabled');

        // Stop background processes
        // Cleanup would happen here
      },

      // Plugin uninstallation
      onUninstall: async (_context) => {
        console.log('StyleMap plugin uninstalling...');

        // Close database connections
        const { StyleMapDatabase } = await import('./src/database/StyleMapDatabase');
        await StyleMapDatabase.close();

        console.log('StyleMap plugin uninstalled');
      },
    },

    // Auto-start plugin when system loads
    autoStart: true,
  },

  // Entity handlers registration
  entityHandlers: {
    stylemap: new StyleMapEntityHandler(),
  },
} as const;

/**
 * Plugin factory function
 * Creates and configures the StyleMap plugin instance
 */
export function createStyleMapPlugin(config?: Partial<PluginConfig>): PluginConfig {
  return {
    ...stylemapPlugin,
    ...config,
    // Ensure core properties are not overridden
    id: stylemapPlugin.id,
    name: stylemapPlugin.name,
    version: stylemapPlugin.version,
  };
}

/**
 * Plugin validation function
 * Validates plugin configuration and dependencies
 */
export function validateStyleMapPlugin(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required dependencies
  // const requiredDeps = stylemapPlugin.dependencies?.required;
  // Note: In a real implementation, this would check if dependencies are available

  // Validate configuration
  if (!stylemapPlugin.nodeTypes || stylemapPlugin.nodeTypes.length === 0) {
    errors.push('No node types defined');
  }

  if (!stylemapPlugin.database || !stylemapPlugin.database.tables) {
    errors.push('No database schema defined');
  }

  // Performance warnings - commented out as performance property doesn't exist in type
  // if (stylemapPlugin.performance?.maxFileSize > 100 * 1024 * 1024) {
  //   warnings.push('Large max file size may impact performance');
  // }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Export plugin configuration as default
export default stylemapPlugin;
