/**
 * @hierarchidb/plugin-import-export
 *
 * Import/Export Plugin for HierarchiDB
 * Provides data import/export capabilities with multiple format support
 */

// Export main plugin definition
export { ImportExportDefinition } from './definitions/ImportExportDefinition';

// Export types
export type {
  ImportExportEntity,
  CreateImportExportData,
  UpdateImportExportData,
  OperationType,
  DataFormat,
  SourceConfiguration,
  TargetConfiguration,
  TransformConfiguration,
  OperationStatus,
  OperationProgress,
  ExecutionRecord,
  ImportExportStatistics,
} from './types/ImportExportEntity';

export type { ImportExportAPI } from './types/ImportExportAPI';

// Export handlers
export { ImportExportEntityHandler } from './handlers/ImportExportEntityHandler';

// Export services
export { ImportExportService } from './services/ImportExportService';

// Export constants
export {
  DEFAULT_SOURCE_CONFIG,
  DEFAULT_TARGET_CONFIG,
  DEFAULT_TRANSFORM_CONFIG,
  DEFAULT_PROGRESS,
} from './types/ImportExportEntity';

// Plugin metadata
export const PLUGIN_VERSION = '1.0.0';
export const PLUGIN_NAME = '@hierarchidb/feature-import-export-plugin';
export const PLUGIN_DESCRIPTION = 'Data import/export and format conversion plugin for HierarchiDB';

// Utility functions

/**
 * Validate operation name
 */
export function validateOperationName(name: string): boolean {
  return Boolean(name && name.trim().length > 0 && name.length <= 255);
}

/**
 * Get supported data formats
 */
export function getSupportedFormats(): string[] {
  return ['json', 'csv', 'xml', 'yaml', 'excel', 'geojson'];
}

/**
 * Check if format supports import
 */
export function formatSupportsImport(format: string): boolean {
  return ['json', 'csv', 'xml', 'excel', 'geojson'].includes(format);
}

/**
 * Check if format supports export
 */
export function formatSupportsExport(format: string): boolean {
  return ['json', 'csv', 'xml', 'excel', 'geojson', 'pdf'].includes(format);
}

/**
 * Default plugin configuration
 */
export const PLUGIN_CONFIG = {
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  nodeType: 'import-export',
  capabilities: {
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: false,
    supportedOperations: ['create', 'read', 'update', 'delete', 'execute'] as const,
  },
} as const;
