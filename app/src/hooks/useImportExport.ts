import type {
  ImportProgress as APIImportProgress,
  ImportData,
  ImportValidationResult,
} from '~/types/import-export';
import type { BuildWorkerAPI } from '~/types/worker-api';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { Remote } from 'comlink';
import { useCallback, useRef, useState } from 'react';
import { getInstalledPlugins } from '~/plugin-runtime/plugin-registry';

// Import/Export Types
export interface ImportFileOptions {
  file: File;
  targetNodeId: NodeId;
  format: 'json' | 'csv';
  csvOptions?: CSVImportOptions;
  onProgress?: (progress: ImportProgress) => void;
}

export interface ExportNodesOptions {
  nodeIds: NodeId[];
  format: 'json' | 'csv';
  includeChildren: boolean;
  csvOptions?: CSVExportOptions;
  onProgress?: (progress: ExportProgress) => void;
}

export interface CSVImportOptions {
  hasHeader: boolean;
  columnMapping?: Record<string, number>;
  delimiter?: string;
}

export interface CSVExportOptions {
  includeHeader: boolean;
  columns: string[];
  delimiter?: string;
}

export interface ImportProgress {
  phase: 'parsing' | 'validating' | 'importing' | 'completed';
  current: number;
  total: number;
  message: string;
}

export interface ExportProgress {
  phase: 'collecting' | 'formatting' | 'creating' | 'completed';
  current: number;
  total: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  errors?: string[];
}

type ImportNode = ImportData['nodes'][number];
type ImportNodesPayload = ImportData;

/**
 * Hook for import/export functionality
 * @param client - Worker API client instance
 * @param ready - Whether the worker is ready
 */
export function useImportExport(client?: Remote<BuildWorkerAPI>, ready?: boolean) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importError, setImportError] = useState<Error | null>(null);
  const [exportError, setExportError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validateImportData = useCallback(async (data: ImportNodesPayload) => {
    return validateImportDataPayload(data);
  }, []);

  /**
   * Import file with progress tracking
   */
  const importFile = useCallback(
    async (options: ImportFileOptions): Promise<ImportResult> => {
      if (!ready || !client) {
        throw new Error('Worker not ready');
      }

      setIsImporting(true);
      setImportError(null);
      abortControllerRef.current = new AbortController();

      try {
        const { file, targetNodeId, format, csvOptions, onProgress } = options;

        // Read file content
        const content = await readFileContent(file);

        // Parse and validate content based on format
        let parsedData: unknown;
        if (format === 'json') {
          parsedData = JSON.parse(content);
        } else if (format === 'csv') {
          parsedData = parseCSV(content, csvOptions);
        } else {
          throw new Error(`Unsupported format: ${format}`);
        }

        const normalizedData = normalizeImportData(parsedData);

        // Validate import data
        const validation = await validateImportData(normalizedData);
        if (!validation.valid) {
          const message =
            validation.message ??
            (validation.errors && validation.errors.length > 0
              ? validation.errors.join(', ')
              : 'Validation failed');
          throw new Error(`Validation failed: ${message}`);
        }

        // Report parsing complete
        onProgress?.({
          phase: 'validating',
          current: 1,
          total: 3,
          message: 'Validating data...',
        });

        // Process import via Worker API
        const result = await processImport(client, normalizedData, targetNodeId, onProgress);

        // Report completion
        onProgress?.({
          phase: 'completed',
          current: 3,
          total: 3,
          message: `Successfully imported ${result.importedCount} nodes`,
        });

        return result;
      } catch (error) {
        const err = error as Error;
        setImportError(err);
        throw err;
      } finally {
        setIsImporting(false);
        abortControllerRef.current = null;
      }
    },
    [client, ready, validateImportData]
  );

  /**
   * Export nodes with progress tracking
   */
  const exportNodes = useCallback(
    async (options: ExportNodesOptions): Promise<Blob> => {
      if (!ready || !client) {
        throw new Error('Worker not ready');
      }

      setIsExporting(true);
      setExportError(null);
      abortControllerRef.current = new AbortController();

      try {
        const { nodeIds, format, includeChildren, csvOptions, onProgress } = options;

        // Report collection phase
        onProgress?.({
          phase: 'collecting',
          current: 1,
          total: 3,
          message: 'Collecting nodes...',
        });

        // Collect nodes from Worker API
        const nodes = await collectNodesForExport(client, nodeIds, includeChildren);

        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Export cancelled');
        }

        // Report formatting phase
        onProgress?.({
          phase: 'formatting',
          current: 2,
          total: 3,
          message: 'Formatting data...',
        });

        // Format data based on export format
        let content: string;
        if (format === 'json') {
          content = JSON.stringify({ nodes }, null, 2);
        } else if (format === 'csv') {
          content = formatCSV(nodes, csvOptions);
        } else {
          throw new Error(`Unsupported format: ${format}`);
        }

        // Create blob
        const blob = new Blob([content], {
          type: format === 'json' ? 'application/json' : 'text/csv',
        });

        // Report completion
        onProgress?.({
          phase: 'completed',
          current: 3,
          total: 3,
          message: `Successfully exported ${nodes.length} nodes`,
        });

        return blob;
      } catch (error) {
        const err = error as Error;
        setExportError(err);
        throw err;
      } finally {
        setIsExporting(false);
        abortControllerRef.current = null;
      }
    },
    [client, ready]
  );

  /**
   * Cancel ongoing import/export operation
   */
  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const cancelImport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * Detect file format from file extension and MIME type
   */
  const detectFileFormat = useCallback((file: File): 'json' | 'csv' | undefined => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type.toLowerCase();

    if (extension === 'json' || mimeType === 'application/json') {
      return 'json';
    }
    if (extension === 'csv' || mimeType === 'text/csv') {
      return 'csv';
    }

    return undefined;
  }, []);

  /**
   * Validate CSV columns
   */
  const validateTabularColumns = useCallback(
    (data: string[][], options: { requiredColumns: string[] }): ImportValidationResult => {
      const errors: string[] = [];

      if (data.length === 0) {
        errors.push('Tabular file is empty');
        return { valid: false, errors, message: 'Tabular file is empty' };
      }

      const headers = data[0];
      const { requiredColumns } = options;

      if (headers) {
        requiredColumns.forEach((col) => {
          if (!headers.includes(col)) {
            errors.push(`Missing required column: ${col}`);
          }
        });
      } else {
        errors.push('CSV headers not found');
      }

      if (errors.length > 0) {
        return { valid: false, errors, message: errors.join(', ') };
      }

      return { valid: true };
    },
    []
  );

  return {
    // State
    isImporting,
    isExporting,
    importError,
    exportError,

    // Actions
    importFile,
    exportNodes,
    cancelImport,
    cancelExport,

    // Utilities
    detectFileFormat,
    validateImportData,
    validateTabularColumns,
  };
}

// Helper functions

async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function formatCSV(nodes: TreeNode[], options?: CSVExportOptions): string {
  const delimiter = options?.delimiter || ',';
  const includeHeader = options?.includeHeader ?? true;
  const columns = options?.columns || ['id', 'name', 'nodeType', 'description'];

  const rows: string[][] = [];

  if (includeHeader) {
    rows.push(columns);
  }

  nodes.forEach((node) => {
    const nodeRecord = node as unknown as Record<string, unknown>;
    const row = columns.map((col) => {
      const value = nodeRecord[col] ?? '';
      // Escape values containing delimiter or quotes
      if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    });
    rows.push(row);
  });

  return rows.map((row) => row.join(delimiter)).join('\n');
}

async function processImport(
  client: Remote<BuildWorkerAPI>,
  data: ImportNodesPayload,
  targetNodeId: NodeId,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const importExportAPI = await client.getImportExportAPI();

  const result = await importExportAPI.importNodes({
    treeId: '' as TreeId, // Will be determined by context
    targetParentId: targetNodeId,
    data: data,
    format: 'json',
    onProgress: (apiProgress: APIImportProgress) => {
      onProgress?.({
        phase:
          apiProgress.phase === 'validating'
            ? 'validating'
            : apiProgress.phase === 'importing'
              ? 'importing'
              : apiProgress.phase === 'finalizing'
                ? 'importing'
                : 'completed',
        current: apiProgress.current,
        total: apiProgress.total,
        message: apiProgress.message,
      });
    },
  });

  return {
    success: result.success,
    importedCount: result.importedCount,
    errors: result.errors,
  };
}

async function collectNodesForExport(
  client: Remote<BuildWorkerAPI>,
  nodeIds: NodeId[],
  includeChildren: boolean
): Promise<TreeNode[]> {
  const queryAPI = await client.getQueryAPI();
  const nodes: TreeNode[] = [];

  for (const nodeId of nodeIds) {
    try {
      const node = await queryAPI.getNode(nodeId);
      if (node) {
        nodes.push(node);

        if (includeChildren) {
          const children = await queryAPI.listChildren(nodeId);
          if (children) {
            nodes.push(...children);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to collect node ${nodeId}:`, error);
    }
  }

  return nodes;
}

function normalizeImportData(data: unknown): ImportNodesPayload {
  const mapEntries = (entries: unknown[], parentName: string) =>
    entries.map((entry, index) => {
      if (entry && typeof entry === 'object') {
        return coerceImportNode(
          entry as Record<string, unknown>,
          `${parentName} Child ${index + 1}`
        );
      }
      return coerceImportNode({}, `${parentName} Child ${index + 1}`);
    });

  if (Array.isArray(data)) {
    return { nodes: mapEntries(data, 'Imported Node') };
  }
  if (data && typeof data === 'object') {
    const maybeNodes = (data as { nodes?: unknown }).nodes;
    if (Array.isArray(maybeNodes)) {
      return { nodes: mapEntries(maybeNodes, 'Imported Node') };
    }
  }
  throw new Error('Invalid data structure: missing nodes array');
}

function coerceImportNode(source: Record<string, unknown>, fallbackName: string): ImportNode {
  const nameCandidate = source.name;
  const name =
    typeof nameCandidate === 'string' && nameCandidate.trim().length > 0
      ? nameCandidate
      : fallbackName;
  const childrenSource = source.children;
  const children = Array.isArray(childrenSource)
    ? childrenSource.map((child, index) =>
        coerceImportNode(
          (child && typeof child === 'object' ? child : {}) as Record<string, unknown>,
          `${name} Child ${index + 1}`
        )
      )
    : undefined;
  return { ...source, name, children } as ImportNode;
}

function parseCSV(content: string, options?: CSVImportOptions): ImportNodesPayload {
  const lines = content.split('\n').filter((line) => line.trim());
  const delimiter = options?.delimiter || ',';
  const hasHeader = options?.hasHeader ?? true;

  const rows = lines.map((line) => {
    const quoted = /"([^"\\\\]*(?:\\.[^"\\\\]*)*)"/g;
    return line
      .replace(quoted, (match) => match.replace(/,/g, '\u2001'))
      .split(delimiter)
      .map((cell) =>
        cell
          .replace(/\u2001/g, ',')
          .replace(/^"|"$/g, '')
          .trim()
      );
  });

  if (rows.length === 0) {
    return { nodes: [] };
  }

  const headers = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const nodes = dataRows.map((row, index) => {
    const node: Record<string, unknown> = {};

    if (options?.columnMapping) {
      Object.entries(options.columnMapping).forEach(([field, index]) => {
        node[field] = row[index];
      });
    } else if (hasHeader && headers) {
      headers.forEach((header, index) => {
        node[header] = row[index];
      });
    } else {
      node.name = row[0];
      node.nodeType = row[1];
      node.description = row[2];
    }

    return coerceImportNode(node, `Imported Row ${index + 1}`);
  });

  return { nodes };
}

function validateImportDataPayload(data: ImportNodesPayload): ImportValidationResult {
  const errors: string[] = [];
  const pluginNodeTypes = new Set(getInstalledPlugins().map((plugin) => plugin.nodeType));
  const validNodeTypes = new Set<string>(['folder', 'file', 'project', ...pluginNodeTypes]);

  data.nodes.forEach((node: ImportNode, index: number) => {
    const nodeType = (node as Record<string, unknown>).nodeType;
    if (typeof nodeType === 'string' && !validNodeTypes.has(nodeType)) {
      errors.push(`Node ${index}: invalid node type '${nodeType}'`);
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors, message: errors.join(', ') };
  }

  return { valid: true };
}
