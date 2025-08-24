/**
 * Import/Export Plugin - Entity Types
 * Defines import/export operation entities and their configurations
 */

import { EntityId, NodeId, Timestamp, PeerEntity } from '@hierarchidb/common-core';

/**
 * Main ImportExportEntity - represents an import/export operation
 */
export interface ImportExportEntity extends PeerEntity {
  // Identity (from PeerEntity)
  id: EntityId;
  nodeId: NodeId;
  
  // Basic operation information
  name: string;
  description: string;
  operationType: OperationType;
  
  // Configuration
  sourceConfig: SourceConfiguration;
  targetConfig: TargetConfiguration;
  transformConfig: TransformConfiguration;
  
  // Status and execution
  status: OperationStatus;
  progress: OperationProgress;
  executionHistory: ExecutionRecord[];
  
  // Scheduling
  schedule?: ScheduleConfiguration;
  
  // Lifecycle
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
 * Operation types
 */
export type OperationType = 
  | 'import'        // Import data from external source
  | 'export'        // Export data to external destination
  | 'sync'          // Bidirectional synchronization
  | 'transform';    // Data transformation only

/**
 * Source configuration for import operations
 */
export interface SourceConfiguration {
  sourceType: SourceType;
  sourceFormat: DataFormat;
  sourceLocation: SourceLocation;
  sourceOptions: SourceOptions;
  authentication?: AuthenticationConfig;
}

/**
 * Target configuration for export operations
 */
export interface TargetConfiguration {
  targetType: TargetType;
  targetFormat: DataFormat;
  targetLocation: TargetLocation;
  targetOptions: TargetOptions;
  authentication?: AuthenticationConfig;
}

/**
 * Source types
 */
export type SourceType =
  | 'file'          // Local file upload
  | 'url'           // Remote URL
  | 'database'      // Database connection
  | 'api'           // REST/GraphQL API
  | 'clipboard'     // Clipboard data
  | 'tree';         // Another tree in HierarchiDB

/**
 * Target types
 */
export type TargetType =
  | 'file'          // File download
  | 'database'      // Database export
  | 'api'           // API endpoint
  | 'clipboard'     // Clipboard export
  | 'tree';         // Another tree in HierarchiDB

/**
 * Data formats
 */
export type DataFormat =
  | 'json'          // JSON format
  | 'csv'           // CSV format
  | 'xml'           // XML format
  | 'yaml'          // YAML format
  | 'excel'         // Excel (.xlsx)
  | 'sql'           // SQL dump
  | 'geojson'       // GeoJSON for spatial data
  | 'shapefile'     // ESRI Shapefile
  | 'kml'           // KML format
  | 'hierarchidb';  // Native HierarchiDB format

/**
 * Source location configurations
 */
export type SourceLocation =
  | FileLocation
  | URLLocation
  | DatabaseLocation
  | APILocation
  | TreeLocation;

/**
 * Target location configurations
 */
export type TargetLocation =
  | FileLocation
  | URLLocation
  | DatabaseLocation
  | APILocation
  | TreeLocation;

/**
 * File location
 */
export interface FileLocation {
  type: 'file';
  filename: string;
  fileSize?: number;
  mimeType?: string;
  lastModified?: Timestamp;
}

/**
 * URL location
 */
export interface URLLocation {
  type: 'url';
  url: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
}

/**
 * Database location
 */
export interface DatabaseLocation {
  type: 'database';
  connectionString: string;
  database: string;
  table: string;
  query?: string;
}

/**
 * API location
 */
export interface APILocation {
  type: 'api';
  endpoint: string;
  apiType: 'rest' | 'graphql' | 'soap';
  query?: string;
  mutation?: string;
}

/**
 * Tree location (for tree-to-tree operations)
 */
export interface TreeLocation {
  type: 'tree';
  treeId: string;
  nodeFilter?: NodeFilter;
  includeChildren?: boolean;
  maxDepth?: number;
}

/**
 * Node filter for tree operations
 */
export interface NodeFilter {
  nodeTypes?: string[];
  parentNodeId?: NodeId;
  namePattern?: string;
  createdAfter?: Timestamp;
  createdBefore?: Timestamp;
}

/**
 * Source options
 */
export interface SourceOptions {
  encoding?: string;
  delimiter?: string;
  hasHeader?: boolean;
  skipRows?: number;
  columnMapping?: ColumnMapping;
  dateFormat?: string;
  timeZone?: string;
}

/**
 * Target options
 */
export interface TargetOptions {
  encoding?: string;
  delimiter?: string;
  includeHeader?: boolean;
  compression?: 'none' | 'gzip' | 'zip';
  overwrite?: boolean;
  batchSize?: number;
}

/**
 * Column mapping for data transformation
 */
export interface ColumnMapping {
  [sourceColumn: string]: TargetColumnConfig;
}

/**
 * Target column configuration
 */
export interface TargetColumnConfig {
  targetColumn: string;
  dataType: DataType;
  transformation?: TransformFunction;
  defaultValue?: any;
  required?: boolean;
}

/**
 * Data types
 */
export type DataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'array';

/**
 * Transform functions
 */
export type TransformFunction =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'parseNumber'
  | 'parseDate'
  | 'formatDate'
  | 'splitString'
  | 'joinString'
  | 'custom';

/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
  authType: AuthenticationType;
  credentials: AuthenticationCredentials;
}

/**
 * Authentication types
 */
export type AuthenticationType =
  | 'none'
  | 'basic'
  | 'bearer'
  | 'oauth2'
  | 'apikey'
  | 'database';

/**
 * Authentication credentials
 */
export type AuthenticationCredentials =
  | BasicCredentials
  | BearerCredentials
  | OAuth2Credentials
  | APIKeyCredentials
  | DatabaseCredentials;

export interface BasicCredentials {
  type: 'basic';
  username: string;
  password: string;
}

export interface BearerCredentials {
  type: 'bearer';
  token: string;
}

export interface OAuth2Credentials {
  type: 'oauth2';
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface APIKeyCredentials {
  type: 'apikey';
  keyName: string;
  keyValue: string;
  location: 'header' | 'query' | 'body';
}

export interface DatabaseCredentials {
  type: 'database';
  username: string;
  password: string;
  host: string;
  port: number;
}

/**
 * Transform configuration
 */
export interface TransformConfiguration {
  enabled: boolean;
  rules: TransformRule[];
  validation: ValidationRule[];
  errorHandling: ErrorHandlingConfig;
}

/**
 * Transform rule
 */
export interface TransformRule {
  id: string;
  name: string;
  field: string;
  transformation: TransformFunction;
  parameters?: Record<string, any>;
  condition?: string; // JavaScript expression
}

/**
 * Validation rule
 */
export interface ValidationRule {
  id: string;
  name: string;
  field: string;
  rule: ValidationRuleType;
  parameters?: Record<string, any>;
  required?: boolean;
}

/**
 * Validation rule types
 */
export type ValidationRuleType =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'email'
  | 'url'
  | 'range'
  | 'custom';

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  strategy: ErrorStrategy;
  maxErrors?: number;
  skipInvalidRows?: boolean;
  logErrors?: boolean;
  customHandler?: string; // JavaScript function
}

/**
 * Error handling strategies
 */
export type ErrorStrategy =
  | 'abort'         // Stop on first error
  | 'skip'          // Skip invalid records
  | 'fix'           // Attempt to fix errors
  | 'ignore';       // Continue despite errors

/**
 * Operation status
 */
export type OperationStatus =
  | 'draft'         // Operation is being configured
  | 'ready'         // Ready to execute
  | 'running'       // Currently executing
  | 'completed'     // Successfully completed
  | 'failed'        // Failed with errors
  | 'cancelled'     // Cancelled by user
  | 'scheduled';    // Scheduled for future execution

/**
 * Operation progress
 */
export interface OperationProgress {
  status: OperationStatus;
  percentage: number;
  processedRecords: number;
  totalRecords?: number;
  errorCount: number;
  startTime?: Timestamp;
  endTime?: Timestamp;
  estimatedTimeRemaining?: number;
  currentStep?: string;
  message?: string;
}

/**
 * Execution record
 */
export interface ExecutionRecord {
  id: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  status: OperationStatus;
  processedRecords: number;
  errorCount: number;
  resultSummary?: ExecutionSummary;
  logs: LogEntry[];
}

/**
 * Execution summary
 */
export interface ExecutionSummary {
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  processingTime: number;
  throughputPerSecond: number;
  resultLocation?: string;
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: Timestamp;
  level: LogLevel;
  message: string;
  details?: any;
}

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Schedule configuration
 */
export interface ScheduleConfiguration {
  enabled: boolean;
  scheduleType: ScheduleType;
  cronExpression?: string;
  interval?: number; // minutes
  startDate?: Timestamp;
  endDate?: Timestamp;
  timezone?: string;
}

/**
 * Schedule types
 */
export type ScheduleType =
  | 'once'          // Run once at specified time
  | 'interval'      // Run at regular intervals
  | 'cron'          // Run based on cron expression
  | 'manual';       // Manual execution only

/**
 * Data for creating a new ImportExportEntity
 */
export interface CreateImportExportData {
  name: string;
  description?: string;
  operationType: OperationType;
  sourceConfig?: Partial<SourceConfiguration>;
  targetConfig?: Partial<TargetConfiguration>;
  transformConfig?: Partial<TransformConfiguration>;
  schedule?: Partial<ScheduleConfiguration>;
}

/**
 * Data for updating an existing ImportExportEntity
 */
export interface UpdateImportExportData {
  name?: string;
  description?: string;
  sourceConfig?: Partial<SourceConfiguration>;
  targetConfig?: Partial<TargetConfiguration>;
  transformConfig?: Partial<TransformConfiguration>;
  schedule?: Partial<ScheduleConfiguration>;
}

/**
 * Import/Export statistics
 */
export interface ImportExportStatistics {
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  totalRecordsProcessed: number;
  averageExecutionTime: number;
  lastExecutionTime: Timestamp;
  nextScheduledExecution?: Timestamp;
}

/**
 * Default configurations
 */
export const DEFAULT_SOURCE_CONFIG: Partial<SourceConfiguration> = {
  sourceType: 'file',
  sourceFormat: 'json',
  sourceOptions: {
    encoding: 'utf-8',
    hasHeader: true,
  },
};

export const DEFAULT_TARGET_CONFIG: Partial<TargetConfiguration> = {
  targetType: 'file',
  targetFormat: 'json',
  targetOptions: {
    encoding: 'utf-8',
    includeHeader: true,
    compression: 'none',
  },
};

export const DEFAULT_TRANSFORM_CONFIG: TransformConfiguration = {
  enabled: false,
  rules: [],
  validation: [],
  errorHandling: {
    strategy: 'skip',
    maxErrors: 100,
    skipInvalidRows: true,
    logErrors: true,
  },
};

export const DEFAULT_PROGRESS: OperationProgress = {
  status: 'draft',
  percentage: 0,
  processedRecords: 0,
  errorCount: 0,
};