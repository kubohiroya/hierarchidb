import { useCallback, useRef, useState } from 'react';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import type { ImportProgress as APIImportProgress } from '@hierarchidb/common-api';
import type { Remote } from 'comlink';

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

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Hook for import/export functionality
 * @param client - Worker API client instance
 * @param ready - Whether the worker is ready
 */
export function useImportExport(client?: Remote<WorkerAPIClient>, ready?: boolean) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importError, setImportError] = useState<Error | null>(null);
  const [exportError, setExportError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
        let parsedData: any;
        if (format === 'json') {
          parsedData = JSON.parse(content);
        } else if (format === 'csv') {
          parsedData = parseCSV(content, csvOptions);
        } else {
          throw new Error(`Unsupported format: ${format}`);
        }

        // Validate import data
        const validation = await validateImportData(parsedData);
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Report parsing complete
        onProgress?.({
          phase: 'validating',
          current: 1,
          total: 3,
          message: 'Validating data...',
        });

        // Process import via Worker API
        const result = await processImport(client, parsedData, targetNodeId, onProgress);

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
    [client, ready],
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
    [client, ready],
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
   * Validate import data structure
   */
  const validateImportData = useCallback(async (data: any): Promise<ValidationResult> => {
    const errors: string[] = [];

    if (!data.nodes || !Array.isArray(data.nodes)) {
      // If data is an array, treat it as nodes array
      if (Array.isArray(data)) {
        data = { nodes: data };
      } else {
        errors.push('Invalid data structure: missing nodes array');
        return { valid: false, errors };
      }
    }

    // Validate each node
    const validNodeTypes = ['folder', 'file', 'project', 'shape', 'basemap', 'styler'];

    data.nodes.forEach((node: any, index: number) => {
      if (!node.name) {
        errors.push(`Node ${index}: missing required field 'name'`);
      }
      if (node.nodeType && !validNodeTypes.includes(node.nodeType)) {
        errors.push(`Node ${index}: invalid node type '${node.nodeType}'`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }, []);

  /**
   * Validate CSV columns
   */
  const validateCSVColumns = useCallback(
    (data: string[][], options: { requiredColumns: string[] }): ValidationResult => {
      const errors: string[] = [];

      if (data.length === 0) {
        errors.push('CSV file is empty');
        return { valid: false, errors };
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

      return {
        valid: errors.length === 0,
        errors,
      };
    },
    [],
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
    validateCSVColumns,
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

function parseCSV(content: string, options?: CSVImportOptions): any {
  const lines = content.split('\n').filter((line) => line.trim());
  const delimiter = options?.delimiter || ',';
  const hasHeader = options?.hasHeader ?? true;

  const rows = lines.map((line) => {
    // Simple CSV parsing (can be enhanced with proper CSV library)
    return line.split(delimiter).map((cell) => cell.trim());
  });

  if (rows.length === 0) {
    return { nodes: [] };
  }

  const headers = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  // Convert to nodes
  const nodes = dataRows.map((row) => {
    const node: any = {};

    if (options?.columnMapping) {
      Object.entries(options.columnMapping).forEach(([field, index]) => {
        node[field] = row[index];
      });
    } else if (hasHeader && headers) {
      headers.forEach((header, index) => {
        node[header] = row[index];
      });
    } else {
      // Default mapping
      node.name = row[0];
      node.nodeType = row[1];
      node.description = row[2];
    }

    return node;
  });

  return { nodes };
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
  client: Remote<WorkerAPI>,
  data: any,
  targetNodeId: NodeId,
  onProgress?: (progress: ImportProgress) => void,
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
  client: Remote<WorkerAPI>,
  nodeIds: NodeId[],
  includeChildren: boolean,
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
