import type { NodeId, TreeId, NodeType, ValidationResult } from '@hierarchidb/common-type';

/**
 * Import/Export API for data transfer operations
 * Provides functionality for importing and exporting tree nodes in various formats
 */
export interface ImportExportAPI {
  /**
   * Import nodes from structured data
   * @param params - Import parameters
   * @returns Result of import operation including created node IDs
   */
  importNodes(params: ImportNodesParams): Promise<ImportResult>;

  /**
   * Export nodes to structured data
   * @param params - Export parameters
   * @returns Exported data in requested format
   */
  exportNodes(params: ExportNodesParams): Promise<ExportResult>;

  /**
   * Get supported import formats
   * @returns List of supported import format identifiers
   */
  getSupportedImportFormats(): Promise<NodeType[]>;

  /**
   * Get supported export formats
   * @returns List of supported export format identifiers
   */
  getSupportedExportFormats(): Promise<NodeType[]>;

  /**
   * Validate import data without performing actual import
   * @param params - Validation parameters
   * @returns Validation result with any errors found
   */
  validateImportData(params: ValidateImportParams): Promise<ValidationResult>;

  /**
   * Get import/export operation status
   * @param operationId - ID of the operation to check
   * @returns Current status and progress of the operation
   */
  getOperationStatus(operationId: string): Promise<OperationStatus | null>;

  /**
   * Cancel an ongoing import/export operation
   * @param operationId - ID of the operation to cancel
   * @returns Success/failure of cancellation
   */
  cancelOperation(operationId: string): Promise<{ success: boolean; error?: string }>;
}

/**
 * Parameters for node import operation
 */
export interface ImportNodesParams {
  /** Target tree for import */
  treeId: TreeId;

  /** Parent node under which to import */
  targetParentId: NodeId;

  /** Data to import */
  data: ImportData;

  /** Import format */
  format: 'json' | 'csv' | 'xml';

  /** Options for handling conflicts */
  conflictResolution?: 'skip' | 'replace' | 'rename';

  /** Whether to validate before import */
  validateFirst?: boolean;

  /** Progress callback */
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * Import data structure
 */
export interface ImportData {
  /** Nodes to import */
  nodes: Array<{
    name: string;
    nodeType?: string;
    description?: string;
    metadata?: Record<string, any>;
    children?: ImportData['nodes'];
  }>;

  /** Additional metadata */
  metadata?: {
    version?: string;
    createdAt?: number;
    source?: string;
  };
}

/**
 * Parameters for node export operation
 */
export interface ExportNodesParams {
  /** Node IDs to export */
  nodeIds: NodeId[];

  /** Export format */
  format: 'json' | 'csv' | 'xml';

  /** Whether to include child nodes */
  includeChildren?: boolean;

  /** Whether to include node metadata */
  includeMetadata?: boolean;

  /** For CSV exports - columns to include */
  csvColumns?: string[];

  /** Progress callback */
  onProgress?: (progress: ExportProgress) => void;
}

/**
 * Import operation result
 */
export interface ImportResult {
  /** Whether import succeeded */
  success: boolean;

  /** IDs of successfully imported nodes */
  importedNodeIds: NodeId[];

  /** Number of nodes imported */
  importedCount: number;

  /** Number of nodes skipped */
  skippedCount: number;

  /** Any errors encountered */
  errors?: string[];

  /** Operation ID for status tracking */
  operationId?: string;
}

/**
 * Export operation result
 */
export interface ExportResult {
  /** Whether export succeeded */
  success: boolean;

  /** Exported data */
  data: string | Blob;

  /** Format of exported data */
  format: string;

  /** Number of nodes exported */
  exportedCount: number;

  /** MIME type for download */
  mimeType: string;

  /** Suggested filename */
  filename: string;

  /** Operation ID for status tracking */
  operationId?: string;
}

/**
 * Import data validation parameters
 */
export interface ValidateImportParams {
  /** Data to validate */
  data: ImportData;

  /** Expected format */
  format: 'json' | 'csv' | 'xml';

  /** Target tree context for validation */
  treeId?: TreeId;

  /** Target parent for context validation */
  targetParentId?: NodeId;
}

/**
 * Validation result
export interface ValidationResult {
  valid: boolean;

  errors: ValidationError[];

  warnings?: ValidationWarning[];

  statistics?: {
    nodeCount: number;
    maxDepth: number;
    nodeTypes: Record<string, number>;
  };
}

export interface ValidationError {

  code: string;


  message: string;


  path?: string;


  line?: number;
}
*/

/**
 * Validation warning details
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;

  /** Warning message */
  message: string;

  /** Path to warning in data structure */
  path?: string;
}

/**
 * Import progress information
 */
export interface ImportProgress {
  /** Current phase of import */
  phase: 'validating' | 'importing' | 'finalizing';

  /** Current item being processed */
  current: number;

  /** Total items to process */
  total: number;

  /** Progress percentage (0-100) */
  percentage: number;

  /** Current status message */
  message: string;

  /** Estimated time remaining in ms */
  estimatedTimeRemaining?: number;
}

/**
 * Export progress information
 */
export interface ExportProgress {
  /** Current phase of export */
  phase: 'collecting' | 'formatting' | 'encoding';

  /** Current item being processed */
  current: number;

  /** Total items to process */
  total: number;

  /** Progress percentage (0-100) */
  percentage: number;

  /** Current status message */
  message: string;

  /** Estimated time remaining in ms */
  estimatedTimeRemaining?: number;
}

/**
 * Operation status information
 */
export interface OperationStatus {
  /** Operation ID */
  operationId: string;

  /** Operation type */
  type: 'import' | 'export';

  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  /** Progress information */
  progress?: ImportProgress | ExportProgress;

  /** Result if completed */
  result?: ImportResult | ExportResult;

  /** Error if failed */
  error?: string;

  /** Start time */
  startedAt: number;

  /** End time if completed */
  completedAt?: number;
}
