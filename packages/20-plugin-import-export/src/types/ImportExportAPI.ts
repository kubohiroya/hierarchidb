/**
 * Import/Export Plugin - API Types
 * API interface definitions for import/export operations
 */

// import { NodeId } from '@hierarchidb/00-core';
type NodeId = string;

// DOM API types for TypeScript 4.9 compatibility
declare global {
  interface File extends Blob {
    readonly lastModified: number;
    readonly name: string;
    readonly webkitRelativePath: string;
  }
}
import { 
  ImportExportEntity, 
  CreateImportExportData, 
  UpdateImportExportData,
  ImportExportStatistics,
  OperationProgress,
  ExecutionRecord,
  DataFormat,
  OperationType
} from './ImportExportEntity';

/**
 * Main Import/Export API interface
 */
export interface ImportExportAPI {
  // Core CRUD operations
  createOperation(nodeId: NodeId, data: CreateImportExportData): Promise<ImportExportEntity>;
  getOperation(nodeId: NodeId): Promise<ImportExportEntity | undefined>;
  updateOperation(nodeId: NodeId, data: UpdateImportExportData): Promise<void>;
  deleteOperation(nodeId: NodeId): Promise<void>;

  // Execution operations
  executeOperation(nodeId: NodeId): Promise<string>; // Returns execution ID
  cancelOperation(nodeId: NodeId): Promise<void>;
  getOperationProgress(nodeId: NodeId): Promise<OperationProgress>;
  getExecutionHistory(nodeId: NodeId): Promise<ExecutionRecord[]>;

  // Data preview and validation
  previewData(nodeId: NodeId, sampleSize?: number): Promise<DataPreview>;
  validateConfiguration(nodeId: NodeId): Promise<ValidationResult>;
  testConnection(nodeId: NodeId): Promise<ConnectionTestResult>;

  // Template and format operations
  getAvailableFormats(): Promise<FormatInfo[]>;
  getOperationTemplates(operationType: OperationType): Promise<OperationTemplate[]>;
  createTemplate(nodeId: NodeId, templateName: string): Promise<OperationTemplate>;

  // Batch operations
  executeBatch(nodeIds: NodeId[]): Promise<BatchExecutionResult>;
  getBatchProgress(batchId: string): Promise<BatchProgress>;

  // Statistics and monitoring
  getStatistics(nodeId: NodeId): Promise<ImportExportStatistics>;
  getSystemStatistics(): Promise<SystemStatistics>;

  // Import/Export file operations
  uploadFile(file: File): Promise<FileUploadResult>;
  downloadResult(nodeId: NodeId, executionId: string): Promise<FileDownloadResult>;
}

/**
 * Data preview result
 */
export interface DataPreview {
  operationId: NodeId;
  sampleSize: number;
  totalRecords: number;
  columns: ColumnInfo[];
  sampleData: Record<string, any>[];
  dataTypes: DataTypeInference[];
  quality: DataQualityReport;
}

/**
 * Column information
 */
export interface ColumnInfo {
  name: string;
  index: number;
  dataType: string;
  nullable: boolean;
  uniqueValues?: number;
  sampleValues: any[];
}

/**
 * Data type inference
 */
export interface DataTypeInference {
  column: string;
  inferredType: string;
  confidence: number;
  suggestedTransformation?: string;
}

/**
 * Data quality report
 */
export interface DataQualityReport {
  totalRows: number;
  completeRows: number;
  emptyRows: number;
  duplicateRows: number;
  invalidRows: number;
  qualityScore: number; // 0-100
  issues: DataQualityIssue[];
}

/**
 * Data quality issue
 */
export interface DataQualityIssue {
  type: QualityIssueType;
  column?: string;
  row?: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

/**
 * Quality issue types
 */
export type QualityIssueType =
  | 'missing_data'
  | 'invalid_format'
  | 'out_of_range'
  | 'duplicate'
  | 'inconsistent'
  | 'encoding_issue';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  impact: string;
}

/**
 * Validation suggestion
 */
export interface ValidationSuggestion {
  field: string;
  suggestion: string;
  benefit: string;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean;
  responseTime: number;
  message: string;
  details?: ConnectionDetails;
}

/**
 * Connection details
 */
export interface ConnectionDetails {
  serverVersion?: string;
  availableTables?: string[];
  recordCount?: number;
  lastUpdated?: number;
  capabilities?: string[];
}

/**
 * Format information
 */
export interface FormatInfo {
  format: DataFormat;
  name: string;
  description: string;
  extensions: string[];
  mimeTypes: string[];
  supportsImport: boolean;
  supportsExport: boolean;
  features: FormatFeature[];
}

/**
 * Format features
 */
export interface FormatFeature {
  name: string;
  description: string;
  supported: boolean;
}

/**
 * Operation template
 */
export interface OperationTemplate {
  id: string;
  name: string;
  description: string;
  operationType: OperationType;
  category: string;
  sourceConfig: any;
  targetConfig: any;
  transformConfig: any;
  tags: string[];
  popularity: number;
  createdAt: number;
}

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
  batchId: string;
  totalOperations: number;
  startedOperations: number;
  failedToStart: FailedOperation[];
  estimatedDuration: number;
}

/**
 * Failed operation info
 */
export interface FailedOperation {
  nodeId: NodeId;
  reason: string;
  error: string;
}

/**
 * Batch progress
 */
export interface BatchProgress {
  batchId: string;
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  runningOperations: number;
  overallProgress: number;
  estimatedTimeRemaining: number;
  operations: OperationBatchStatus[];
}

/**
 * Operation batch status
 */
export interface OperationBatchStatus {
  nodeId: NodeId;
  operationName: string;
  status: string;
  progress: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

/**
 * System statistics
 */
export interface SystemStatistics {
  totalOperations: number;
  activeOperations: number;
  completedToday: number;
  failedToday: number;
  averageExecutionTime: number;
  totalDataProcessed: number; // bytes
  popularFormats: FormatUsageStats[];
  systemLoad: SystemLoad;
}

/**
 * Format usage statistics
 */
export interface FormatUsageStats {
  format: DataFormat;
  operationCount: number;
  recordsProcessed: number;
  lastUsed: number;
}

/**
 * System load information
 */
export interface SystemLoad {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  queuedOperations: number;
}

/**
 * File upload result
 */
export interface FileUploadResult {
  fileId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadTime: number;
  previewAvailable: boolean;
  detectedFormat?: DataFormat;
}

/**
 * File download result
 */
export interface FileDownloadResult {
  filename: string;
  size: number;
  mimeType: string;
  downloadUrl: string;
  expiresAt: number;
}

/**
 * Import/Export events for real-time updates
 */
export interface ImportExportEvents {
  // Operation lifecycle events
  onOperationStart: (nodeId: NodeId, executionId: string) => void;
  onOperationProgress: (nodeId: NodeId, progress: OperationProgress) => void;
  onOperationComplete: (nodeId: NodeId, result: ExecutionRecord) => void;
  onOperationError: (nodeId: NodeId, error: OperationError) => void;
  onOperationCancel: (nodeId: NodeId) => void;

  // Batch events
  onBatchStart: (batchId: string) => void;
  onBatchProgress: (batchId: string, progress: BatchProgress) => void;
  onBatchComplete: (batchId: string) => void;

  // System events
  onSystemStatusChange: (status: SystemStatus) => void;
}

/**
 * Operation error details
 */
export interface OperationError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * System status
 */
export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'error';
  message: string;
  activeOperations: number;
  systemLoad: SystemLoad;
  lastUpdate: number;
}