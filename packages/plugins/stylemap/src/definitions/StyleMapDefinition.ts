/**
 * @file StyleMapDefinition.ts
 * @description UnifiedPluginDefinition for StyleMap plugin
 * Integrates with hierarchidb plugin system following basemap patterns
 * References:
 * - packages/plugins/basemap/src/definitions/BaseMapDefinition.ts
 * - docs/spec/plugin-stylemap-requirements.md (REQ-501-504)
 * - packages/worker/src/WorkerAPIImpl.ts
 */

import type { TreeNodeType, TreeNodeId } from '@hierarchidb/core';
import type {
  UnifiedPluginDefinition,
  NodeLifecycleHooks,
  WorkerPluginRouterAction,
  IconDefinition,
} from '@hierarchidb/worker';
import type { StyleMapEntity, StyleMapWorkingCopy } from '../types';
import { StyleMapEntityHandler } from '../handlers/StyleMapEntityHandler';
import { StyleMapDatabase } from '../database/StyleMapDatabase';
import { validateStyleMapEntity } from '../types';

/**
 * Lifecycle hooks for StyleMap nodes
 * Implements comprehensive validation and resource management
 */
const stylemapLifecycle: NodeLifecycleHooks<StyleMapEntity, StyleMapWorkingCopy> = {
  // Before create hook - validate file and configuration
  beforeCreate: async (_parentId: TreeNodeId, nodeData: Partial<StyleMapEntity>) => {
    // Validate file format if filename provided
    if (nodeData.filename) {
      const supportedFormats = /\.(csv|tsv|xlsx|xls)$/i;
      if (!supportedFormats.test(nodeData.filename)) {
        throw new Error('Unsupported file format. Only CSV, TSV, and Excel files are supported.');
      }
    }

    // Validate column mapping if provided
    if (nodeData.keyColumn && nodeData.valueColumn) {
      if (nodeData.keyColumn === nodeData.valueColumn) {
        throw new Error('Key column and value column must be different.');
      }
    }

    // Validate StyleMap configuration if provided
    if (nodeData.styleMapConfig) {
      const { validateStyleMapConfig } = await import('../types/StyleMapConfig');
      const validation = validateStyleMapConfig(nodeData.styleMapConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid StyleMap configuration: ${validation.errors.join(', ')}`);
      }
    }

    // Validate filter rules if provided
    if (nodeData.filterRules && nodeData.filterRules.length > 0) {
      const { validateFilterRule } = await import('../types/FilterRule');
      for (const rule of nodeData.filterRules) {
        const validation = validateFilterRule(rule);
        if (!validation.isValid) {
          throw new Error(`Invalid filter rule: ${validation.errors.join(', ')}`);
        }
      }
    }
  },

  // After create hook - initialize resources and cache
  afterCreate: async (nodeId: TreeNodeId, entity: StyleMapEntity) => {
    const db = StyleMapDatabase.getInstance();

    // Generate cache key if file content is available
    if (entity.filename && !entity.cacheKey) {
      const { generateCacheKey } = await import('../utils/hashUtils');
      const cacheKey = await generateCacheKey(entity.filename, entity.styleMapConfig);

      await db.updateEntity(nodeId, { cacheKey });
    }

    // Log creation for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`StyleMap created: ${nodeId} - ${entity.filename || 'Untitled'}`);
    }

    // Initialize performance tracking using MonitoredStyleMapDatabase
    // Note: In production, the monitored database is created at initialization
  },

  // Before update hook - validate changes and dependencies
  beforeUpdate: async (nodeId: TreeNodeId, changes: Partial<StyleMapEntity>) => {
    // Validate entity integrity with changes
    const db = StyleMapDatabase.getInstance();
    const existing = await db.getEntity(nodeId);

    if (!existing) {
      throw new Error('StyleMap entity not found for update');
    }

    const merged = { ...existing, ...changes };
    const validation = validateStyleMapEntity(merged);

    if (!validation.isValid) {
      throw new Error(`Invalid StyleMap update: ${validation.errors.join(', ')}`);
    }

    // Warn about potentially destructive changes
    if (changes.keyColumn && changes.keyColumn !== existing.keyColumn) {
      console.warn(
        `Changing key column from "${existing.keyColumn}" to "${changes.keyColumn}" may affect existing mappings`
      );
    }

    if (
      changes.styleMapConfig &&
      JSON.stringify(changes.styleMapConfig) !== JSON.stringify(existing.styleMapConfig)
    ) {
      console.warn('StyleMap configuration changes will invalidate cache');
    }
  },

  // After update hook - refresh cache and notify UI
  afterUpdate: async (nodeId: TreeNodeId, entity: StyleMapEntity) => {
    const db = StyleMapDatabase.getInstance();

    // Clear related cache entries if configuration changed
    if (entity.cacheKey) {
      await db.deleteCache(entity.cacheKey);
    }

    // Regenerate cache key if needed
    if (entity.filename && entity.styleMapConfig) {
      const { generateCacheKey } = await import('../utils/hashUtils');
      const newCacheKey = await generateCacheKey(entity.filename, entity.styleMapConfig);

      if (newCacheKey !== entity.cacheKey) {
        await db.updateEntity(nodeId, { cacheKey: newCacheKey });
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`StyleMap updated: ${nodeId}`);
    }
  },

  // Before delete hook - cleanup preparation and validation
  beforeDelete: async (nodeId: TreeNodeId) => {
    const db = StyleMapDatabase.getInstance();
    const entity = await db.getEntity(nodeId);

    if (!entity) {
      console.warn(`StyleMap entity ${nodeId} not found during delete preparation`);
      return;
    }

    // Check for active working copies
    const workingCopy = await db.getWorkingCopy(nodeId);
    if (workingCopy && workingCopy.isDirty) {
      throw new Error(
        'Cannot delete StyleMap with unsaved changes. Please commit or discard the working copy first.'
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`Preparing to delete StyleMap: ${nodeId} - ${entity.filename || 'Untitled'}`);
    }
  },

  // After delete hook - cleanup resources
  afterDelete: async (nodeId: TreeNodeId) => {
    // Note: The database delete operation already handles cascade cleanup
    // This hook is for additional cleanup like clearing external resources

    if (process.env.NODE_ENV === 'development') {
      console.log(`StyleMap deleted: ${nodeId}`);
    }
  },

  // Before commit hook - validate working copy
  beforeCommit: async (_nodeId: TreeNodeId, workingCopy: StyleMapWorkingCopy) => {
    // Validate working copy completeness
    if (!workingCopy.isDirty) {
      console.warn('Committing working copy with no changes');
      return;
    }

    // Ensure required fields are present for commit
    if (workingCopy.keyColumn && workingCopy.valueColumn && !workingCopy.styleMapConfig) {
      throw new Error(
        'StyleMap configuration is required when both key and value columns are specified'
      );
    }

    // Validate the working copy as if it were a complete entity
    const validation = validateStyleMapEntity(workingCopy);
    if (!validation.isValid) {
      throw new Error(`Cannot commit invalid StyleMap: ${validation.errors.join(', ')}`);
    }
  },

  // After commit hook - update cache and notify
  afterCommit: async (nodeId: TreeNodeId, entity: StyleMapEntity) => {
    // Clear any cached data since entity has changed
    const db = StyleMapDatabase.getInstance();
    if (entity.cacheKey) {
      await db.deleteCache(entity.cacheKey);
    }

    // Trigger background cache regeneration if data is available
    if (entity.tableMetadataId && entity.styleMapConfig) {
      // Note: In a full implementation, this would trigger background processing
      console.log('StyleMap committed - cache invalidated for regeneration');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`Working copy committed for StyleMap: ${nodeId}`);
    }
  },
};

/**
 * Router actions for StyleMap plugin
 * Defines UI components for different views
 */
const stylemapRouterActions: Record<string, WorkerPluginRouterAction> = {
  view: {
    path: 'view',
    componentPath: '../components/StyleMapView',
  },
  edit: {
    path: 'edit',
    componentPath: '../components/StyleMapEditor',
  },
  preview: {
    path: 'preview',
    componentPath: '../components/StyleMapPreview',
  },
  import: {
    path: 'import',
    componentPath: '../components/StyleMapImport',
  },
};

/**
 * Custom validators for StyleMap entities
 */
const stylemapValidators: Array<{
  name: string;
  validate: (entity: StyleMapEntity) => Promise<boolean | string>;
  message?: string;
}> = [
  {
    name: 'validFileFormat',
    validate: async (entity: StyleMapEntity) => {
      if (!entity.filename) return true;

      const supportedFormats = /\.(csv|tsv|xlsx|xls)$/i;
      if (!supportedFormats.test(entity.filename)) {
        return 'Filename must have a supported extension (.csv, .tsv, .xlsx, .xls)';
      }
      return true;
    },
  },
  {
    name: 'validColumnMapping',
    validate: async (entity: StyleMapEntity) => {
      if (!entity.keyColumn || !entity.valueColumn) return true;

      if (entity.keyColumn === entity.valueColumn) {
        return 'Key column and value column must be different';
      }

      // Additional validation: check if columns exist in table metadata
      if (entity.tableMetadataId) {
        const db = StyleMapDatabase.getInstance();
        const tableMetadata = await db.getTableMetadata(entity.tableMetadataId);

        if (tableMetadata) {
          const columnNames = tableMetadata.columns.map((col) => col.name);

          if (!columnNames.includes(entity.keyColumn)) {
            return `Key column "${entity.keyColumn}" not found in table data`;
          }

          if (!columnNames.includes(entity.valueColumn)) {
            return `Value column "${entity.valueColumn}" not found in table data`;
          }
        }
      }

      return true;
    },
  },
  {
    name: 'validStyleConfiguration',
    validate: async (entity: StyleMapEntity) => {
      if (!entity.styleMapConfig) return true;

      const { validateStyleMapConfig } = await import('../types/StyleMapConfig');
      const validation = validateStyleMapConfig(entity.styleMapConfig);

      if (!validation.isValid) {
        return `Invalid style configuration: ${validation.errors.join(', ')}`;
      }

      return true;
    },
  },
  {
    name: 'validFilterRules',
    validate: async (entity: StyleMapEntity) => {
      if (!entity.filterRules || entity.filterRules.length === 0) return true;

      const { validateFilterRule } = await import('../types/FilterRule');
      const availableColumns = entity.tableMetadataId
        ? await getTableColumns(entity.tableMetadataId)
        : [];

      for (const rule of entity.filterRules) {
        const validation = validateFilterRule(rule, availableColumns);
        if (!validation.isValid) {
          return `Invalid filter rule: ${validation.errors.join(', ')}`;
        }
      }

      return true;
    },
  },
];

// Helper function for validator
async function getTableColumns(tableId: string): Promise<string[]> {
  const db = StyleMapDatabase.getInstance();
  const metadata = await db.getTableMetadata(tableId);
  return metadata?.columns.map((col) => col.name) || [];
}

/**
 * Icon definition for StyleMap plugin
 * Provides multiple formats for different UI contexts
 */
const styleMapIcon: IconDefinition = {
  // MUI icon name (priority)
  muiIconName: 'Palette',
  
  // Unicode emoji fallback
  emoji: '🎨',
  
  // Custom SVG icon
  svg: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.09-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 10c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>`,
  
  // SVG path for icon libraries
  svgPath: 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.09-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 10c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  
  // Icon description for accessibility and UI display
  description: 'Style Map - Import CSV/TSV data and apply dynamic color mappings for visualization',
  
  // Theme color
  color: '#9c27b0'
};

/**
 * StyleMap Unified Plugin Definition
 * Complete integration with hierarchidb plugin system
 */
export const StyleMapUnifiedDefinition: UnifiedPluginDefinition<
  StyleMapEntity,
  never, // No sub-entities for StyleMap
  StyleMapWorkingCopy
> = {
  // Node type identification
  nodeType: 'stylemap' as TreeNodeType,
  name: 'StyleMap',
  displayName: 'Style Map',
  
  // Icon configuration
  icon: styleMapIcon,

  // Database configuration
  database: {
    dbName: 'StyleMapDB',
    tableName: 'entities',
    schema: 'nodeId, filename, keyColumn, valueColumn, tableMetadataId, cacheKey, updatedAt',
    version: 2, // Using optimized schema version
  },

  // Entity handler
  entityHandler: new StyleMapEntityHandler(),

  // Lifecycle hooks
  lifecycle: stylemapLifecycle,

  // UI configuration
  ui: {
    // Main UI components (lazy loaded for performance)
    dialogComponentPath: '../components/StyleMapDialog',
    panelComponentPath: '../components/StyleMapPanel',
    formComponentPath: '../components/StyleMapForm',
    iconComponentPath: '../components/StyleMapIcon',
  },

  // API extensions for StyleMap-specific operations
  api: {
    workerExtensions: {
      // CSV/TSV file processing
      parseDataFile: async (...args: unknown[]): Promise<unknown> => {
        const [_nodeId, file] = args as [TreeNodeId, File];
        const { parseCSVFile } = await import('../utils/csvParser');
        const content = await file.text();
        const delimiter = file.name.endsWith('.tsv') ? '	' : ',';
        return parseCSVFile(content, delimiter);
      },

      // Color mapping generation
      generateColorMapping: async (...args: unknown[]): Promise<unknown> => {
        const [_nodeId, config] = args as [TreeNodeId, any];
        const { generateColorMapping } = await import('../utils/colorMapping');
        return await generateColorMapping(config, []);
      },

      // Filter application
      applyDataFilters: async (...args: unknown[]): Promise<unknown> => {
        const [_nodeId, _rules] = args as [TreeNodeId, any[]];
        // const { applyFilterRules } = await import('../types/FilterRule');
        return {
          filteredRows: [],
          stats: { totalRows: 0, matchedRows: 0, resultRows: 0, matchRate: 0 },
        };
      },

      // Cache management
      clearStyleCache: async (...args: unknown[]): Promise<unknown> => {
        const [_nodeId] = args as [TreeNodeId];
        const db = StyleMapDatabase.getInstance();
        const entity = await db.getEntity(_nodeId);
        if (entity?.cacheKey) {
          await db.deleteCache(entity.cacheKey);
        }
        return undefined;
      },

      // Performance optimization
      optimizeDatabase: async (): Promise<any> => {
        const db = StyleMapDatabase.getInstance();
        const { MonitoredStyleMapDatabase } = await import('../database/MonitoredStyleMapDatabase');
        const monitoredDb = new MonitoredStyleMapDatabase(db);
        return monitoredDb.getMetrics();
      },
    },

    clientExtensions: {
      // Client-side utilities would be defined here
      // These run in the main thread and can access UI context
    },
  },

  // Validation rules
  validation: {
    namePattern: /^[a-zA-Z0-9\s\-_\.]+$/,
    maxChildren: 0, // StyleMap nodes don't have children
    allowedChildTypes: [],
    customValidators: stylemapValidators,
  },

  // React Router v7 routing configuration
  routing: {
    actions: stylemapRouterActions,
    defaultAction: 'view',
  },

  // Plugin metadata
  meta: {
    version: '1.0.0',
    description: 'CSV/TSV data to MapLibre style mapping plugin for hierarchidb',
    author: 'hierarchidb team',
    tags: [
      'stylemap',
      'csv',
      'tsv',
      'maplibre',
      'visualization',
      'color-mapping',
      'data-processing',
    ],
    dependencies: ['@hierarchidb/core', '@hierarchidb/worker', 'dexie'],
  },
};

/**
 * Plugin initialization function
 * Sets up database and optimizations
 */
export async function initializeStyleMapPlugin(): Promise<void> {
  // Initialize database with optimizations
  const db = StyleMapDatabase.getInstance();
  await db.open();

  // Set up performance optimization
  const { StyleMapDatabaseOptimizer } = await import('../database/StyleMapDatabaseOptimization');
  const optimizer = new StyleMapDatabaseOptimizer(db);
  await optimizer.optimizeSchema();

  // Additional initialization
  if (process.env.NODE_ENV === 'development') {
    console.log('StyleMap plugin initialized with performance optimizations');
  }
}

/**
 * Plugin cleanup function
 * Cleanup resources and close database
 */
export async function cleanupStyleMapPlugin(): Promise<void> {
  // Cleanup database
  await StyleMapDatabase.close();

  if (process.env.NODE_ENV === 'development') {
    console.log('StyleMap plugin cleaned up');
  }
}

/**
 * Plugin health check function
 * Validates plugin state and database integrity
 */
export async function healthCheckStyleMapPlugin(): Promise<{
  isHealthy: boolean;
  issues: string[];
  metrics: any;
}> {
  const issues: string[] = [];

  try {
    const db = StyleMapDatabase.getInstance();

    // Check database connectivity
    const stats = await db.getDatabaseStats();

    // Check for common issues
    if (stats.estimatedSize > 500 * 1024 * 1024) {
      // 500MB
      issues.push('Database size is very large, consider cleanup');
    }

    // Validate database integrity
    const { StyleMapDatabaseMigration } = await import('../database/StyleMapDatabaseOptimization');
    const migration = new StyleMapDatabaseMigration(db);
    const integrity = await migration.validateIntegrity();

    if (!integrity.isValid) {
      issues.push(...integrity.errors);
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      metrics: stats,
    };
  } catch (error) {
    return {
      isHealthy: false,
      issues: [`Health check failed: ${error}`],
      metrics: null,
    };
  }
}
