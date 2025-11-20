/**
 * @file plugin-styler-plugin TypeScript Interface Definitions
 * @description Type definitions for plugin-styler-plugin based on eria-cartograph implementation
 * @module @hierarchidb/plugin-styler-plugin/types
 */

import { UUID } from '@hierarchidb/core/types/UUID';
import { TreeNodeId, TreeNodeType } from '@hierarchidb/core/types/TreeNode';
import { PrimaryResourceEntity } from '@hierarchidb/core/types/entities';

// ================================================================================
// 🟢 Core Entity Interfaces (Based on eria-cartograph)
// ================================================================================

/**
 * 🟢 Complete style map data structure stored in IndexedDB
 * Contains metadata and reference to table store
 */
export interface StylerEntity extends PrimaryResourceEntity {
  /** Cache key for accessing the complete file data from Cache API */
  cacheKey?: string;
  /** URL that was used to download the file (for URL-based imports) */
  downloadUrl?: string;
  /** Original filename */
  filename?: string;
  /** Reference to the table store containing the actual data */
  tableMetadataId?: UUID;
  /** Column name used as the key for mapping */
  keyColumn?: string;
  /** Column name used as the value for color mapping */
  valueColumn?: string;
  /** Filter rules to apply to the data */
  filterRules?: FilterRule[];
  /** Color mapping configuration */
  stylerConfig?: StylerConfig;
  /** File content hash for deduplication */
  contentHash?: string;

  // Index signature for compatibility with PeerEntity
  [key: string]: unknown;
}

/**
 * 🟢 Metadata for Tabular/TSV table structure
 */
export interface TableMetadataEntity {
  /** Unique identifier for the table */
  id: UUID;
  /** SHA3 hash of the file content for deduplication */
  contentHash: string;
  /** Original filename */
  filename: string;
  /** Column names in order */
  columns: string[];
  /** Number of data rows (excluding header) */
  rowCount: number;
  /** File size in bytes */
  fileSize: number;
  /** Reference count for garbage collection */
  referenceCount: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

/**
 * 🟢 Individual row data entity
 */
export interface RowEntity {
  /** Unique identifier for the row */
  id: UUID;
  /** Table identifier this row belongs to */
  t: UUID; // tableId (shortened for storage efficiency)
  /** Row index within the table */
  r: number; // rowIndex
  /** Row values corresponding to table columns */
  v: (string | number | null)[]; // values
}

/**
 * 🟢 Working copy for safe editing
 */
export interface StylerWorkingCopy extends StylerEntity {
  /** Original entity ID this working copy is based on */
  originalId?: TreeNodeId;
  /** Working copy specific ID */
  workingCopyId: UUID;
  /** Whether this is a working copy */
  isWorkingCopy: true;
  /** Temporary changes not yet committed */
  pendingChanges?: Partial<StylerEntity>;
}

// ================================================================================
// 🟢 Configuration Interfaces (Based on eria-cartograph)
// ================================================================================

/**
 * 🟢 Color mapping algorithm types
 */
export type ColorMappingAlgorithm = 'linear' | 'logarithmic' | 'quantile' | 'categorical';

/**
 * 🟢 Color space types
 */
export type ColorSpace = 'rgb' | 'hsv';

/**
 * 🟢 MapLibre GL style properties that can be mapped with color values
 */
export type MapLibreStyleProperty =
  | 'fill-color'
  | 'fill-opacity'
  | 'fill-outline-color'
  | 'line-color'
  | 'line-opacity'
  | 'line-width'
  | 'circle-color'
  | 'circle-opacity'
  | 'circle-radius'
  | 'circle-stroke-color'
  | 'circle-stroke-opacity'
  | 'circle-stroke-width';

/**
 * 🟢 Style mapping configuration
 */
export interface StylerConfig {
  /** Color mapping algorithm */
  algorithm: ColorMappingAlgorithm;
  /** Color space for calculation */
  colorSpace: ColorSpace;
  /** Value mapping configuration */
  mapping: {
    /** Minimum value for mapping */
    min: number;
    /** Maximum value for mapping */
    max: number;
    /** Start hue (0-1) for HSV color space */
    hueStart: number;
    /** End hue (0-1) for HSV color space */
    hueEnd: number;
    /** Saturation (0-1) for HSV color space */
    saturation: number;
    /** Brightness/Value (0-1) for HSV color space */
    brightness: number;
  };
  /** Target MapLibre style property */
  targetProperty: MapLibreStyleProperty;
  /** Legacy support - use targetProperty instead */
  strokeWidth?: number;
}

/**
 * 🟢 Filter action types
 */
export type FilterAction = 'Include' | 'Exclude' | 'IncludePattern' | 'ExcludePattern';

/**
 * 🟢 Data filtering rule
 */
export interface FilterRule {
  /** Unique identifier for the rule */
  id: string;
  /** Filter action type */
  action: FilterAction;
  /** Column name to apply filter on */
  keyColumn: string;
  /** Value or pattern to match */
  matchValue: string;
}

// ================================================================================
// 🟡 UI State Interfaces
// ================================================================================

/**
 * 🟡 Form data for Styler creation/editing
 */
export interface StylerFormData {
  /** Styler name */
  name: string;
  /** Styler description */
  description: string;
  /** Uploaded file */
  file?: File;
  /** Selected key column */
  keyColumn?: string;
  /** Selected value column */
  valueColumn?: string;
  /** Filter rules */
  filterRules?: FilterRule[];
  /** Style mapping configuration */
  stylerConfig?: StylerConfig;
  /** Download URL for file-based imports */
  downloadUrl?: string;
}

/**
 * 🟡 PreviewStep state for real-time updates
 */
export interface StylerPreviewState {
  /** Working copy ID */
  workingCopyId: UUID;
  /** Calculated style properties for preview */
  styleProperties: Record<string, any>;
  /** Filtered data for preview */
  previewData: (string | number)[][];
  /** PreviewStep calculation status */
  isCalculating: boolean;
  /** PreviewStep error if any */
  error?: string;
}

/**
 * 🟡 Dialog step state
 */
export interface StylerDialogState {
  /** Current step index */
  currentStep: number;
  /** Maximum step reached */
  maxReachedStep: number;
  /** Form validation state per step */
  stepValidation: Record<number, boolean>;
  /** Whether base-dialog has unsaved changes */
  hasUnsavedChanges: boolean;
  /** Loading state */
  isLoading: boolean;
}

// ================================================================================
// 🟢 API Request/Response Interfaces
// ================================================================================

/**
 * 🟢 File parsing result
 */
export interface ParseFileResult {
  /** Success status */
  success: boolean;
  /** Parsed table metadata */
  tableMetadata?: TableMetadataEntity;
  /** Parsed row data */
  rows?: RowEntity[];
  /** File content hash */
  contentHash?: string;
  /** Error message if parsing failed */
  error?: string;
  /** Parsing statistics */
  stats?: {
    /** Number of rows parsed */
    rowCount: number;
    /** Number of columns detected */
    columnCount: number;
    /** Processing time in milliseconds */
    processingTime: number;
  };
}

/**
 * 🟢 Style calculation result
 */
export interface StyleCalculationResult {
  /** Success status */
  success: boolean;
  /** Generated MapLibre style properties */
  styleProperties?: Record<string, any>;
  /** Color mapping values */
  colorMapping?: Array<{
    key: string | number;
    value: number;
    color: string;
    opacity?: number;
  }>;
  /** Error message if calculation failed */
  error?: string;
}

/**
 * 🟡 Working copy operation result
 */
export interface WorkingCopyResult<T = any> {
  /** Success status */
  success: boolean;
  /** Working copy ID */
  workingCopyId?: UUID;
  /** Result data */
  data?: T;
  /** Error message if operation failed */
  error?: string;
}

// ================================================================================
// 🟢 Service Interface Definitions
// ================================================================================

/**
 * 🟢 Styler Worker API interface
 */
export interface StylerWorkerAPI {
  // File operations
  parseFile(file: File): Promise<ParseFileResult>;
  calculateFileHash(file: File): Promise<string>;

  // Styler CRUD operations
  createStyler(
    parentId: TreeNodeId,
    formData: StylerFormData
  ): Promise<WorkingCopyResult<StylerEntity>>;
  getStyler(nodeId: TreeNodeId): Promise<StylerEntity | undefined>;
  updateStyler(nodeId: TreeNodeId, updates: Partial<StylerEntity>): Promise<void>;
  deleteStyler(nodeId: TreeNodeId): Promise<void>;

  // Working copy operations
  createWorkingCopy(nodeId: TreeNodeId): Promise<WorkingCopyResult<StylerWorkingCopy>>;
  updateWorkingCopy(
    workingCopyId: UUID,
    updates: Partial<StylerEntity>
  ): Promise<WorkingCopyResult>;
  commitWorkingCopy(workingCopyId: UUID): Promise<WorkingCopyResult>;
  discardWorkingCopy(workingCopyId: UUID): Promise<WorkingCopyResult>;

  // Style calculation
  calculateStylerping(config: StylerConfig, data: RowEntity[]): Promise<StyleCalculationResult>;
  generateMapLibreStyle(stylerId: TreeNodeId): Promise<Record<string, any>>;

  // Data filtering
  applyFilters(data: RowEntity[], filters: FilterRule[], columns: string[]): Promise<RowEntity[]>;

  // Cache operations
  getCachedData(contentHash: string): Promise<ParseFileResult | undefined>;
  clearCache(): Promise<void>;
}

/**
 * 🟢 Styler Database interface
 */
export interface StylerDB {
  // Entity operations
  saveStylerEntity(entity: StylerEntity): Promise<void>;
  getStylerEntity(nodeId: TreeNodeId): Promise<StylerEntity | undefined>;
  updateStylerEntity(nodeId: TreeNodeId, updates: Partial<StylerEntity>): Promise<void>;
  deleteStylerEntity(nodeId: TreeNodeId): Promise<void>;
  getAllStylerEntities(): Promise<StylerEntity[]>;

  // Table metadata operations
  saveTableMetadata(metadata: TableMetadataEntity): Promise<void>;
  getTableMetadata(metadataId: UUID): Promise<TableMetadataEntity | undefined>;
  getTableMetadataByHash(contentHash: string): Promise<TableMetadataEntity | undefined>;
  incrementReferenceCount(metadataId: UUID): Promise<void>;
  decrementReferenceCount(metadataId: UUID): Promise<void>;

  // Row operations
  bulkSaveRows(rows: RowEntity[]): Promise<void>;
  getRowsByTable(tableId: UUID): Promise<RowEntity[]>;
  deleteRowsByTable(tableId: UUID): Promise<void>;

  // Working copy operations
  commitWorkingCopy(workingCopy: StylerWorkingCopy): Promise<void>;
  getWorkingCopy(workingCopyId: UUID): Promise<StylerWorkingCopy | undefined>;
  updateWorkingCopy(workingCopyId: UUID, updates: Partial<StylerWorkingCopy>): Promise<void>;
  deleteWorkingCopy(workingCopyId: UUID): Promise<void>;

  // Cleanup operations
  cleanup(): Promise<void>;
  clearAll(): Promise<void>;
}

/**
 * 🟡 File cache service interface
 */
export interface StylerFileCacheService {
  // Cache operations
  getCachedContent(url: string): ParseFileResult | undefined;
  setCachedContent(url: string, content: ParseFileResult): void;
  removeCachedContent(url: string): void;
  clearCache(): void;

  // Reference counting
  addReference(url: string): void;
  removeReference(url: string): void;

  // File operations
  downloadAsFile(url: string, options?: { filename?: string }): Promise<void>;

  // Cache management
  getCacheSize(): number;
  getCacheStats(): {
    totalEntries: number;
    totalSize: number;
    hitRate: number;
  };
}

// ================================================================================
// 🟡 Component Props Interfaces
// ================================================================================

/**
 * 🟡 Styler Dialog component props
 */
export interface StylerDialogProps {
  /** Dialog mode */
  mode: 'create' | 'edit';
  /** Parent node ID for creation */
  parentId: string;
  /** Current step for stepper */
  currentStep?: number;
  /** Step change handler */
  onStepChange?: (step: number) => void;
  /** Styler ID for editing */
  stylerId?: string;
  /** Target node for editing */
  targetNode?: {
    id: string;
    name: string;
    description?: string;
    type: TreeNodeType;
    isDraft: boolean;
  };
  /** Preloaded data for optimization */
  preloadedData?: {
    stylerNode: {
      name: string;
      description?: string;
      type: TreeNodeType;
      isDraft: boolean;
    };
    stylerEntity?: StylerEntity;
    tableMetadataEntity?: TableMetadataEntity;
    rows?: RowEntity[];
  };
}

/**
 * 🟡 Styler Configuration component props
 */
export interface StylerConfigurationProps {
  /** Current configuration */
  config: StylerConfig;
  /** Configuration change handler */
  onChange: (config: StylerConfig) => void;
  /** Value data for algorithm calculation */
  values: number[];
  /** Whether component is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
}

/**
 * 🟡 Styler PreviewStep component props
 */
export interface StylerPreviewProps {
  /** Styler entity for preview */
  stylerEntity?: StylerEntity;
  /** Table metadata */
  tableMetadataEntity?: TableMetadataEntity;
  /** Selected key column */
  selectedKeyColumn: string;
  /** Selected value column */
  selectedValueColumn: string;
  /** Style configuration */
  stylerConfig: StylerConfig;
  /** Filter rules */
  filterRules: FilterRule[];
  /** Table rows for preview */
  tableRows: (string | number)[][];
  /** Loading state */
  loading?: boolean;
}

// ================================================================================
// 🟡 Plugin Integration Interfaces
// ================================================================================

/**
 * 🟡 NodeType definition for plugin registration
 */
export interface StylerNodeTypeDefinition {
  /** Node type identifier */
  nodeType: 'styler-plugin';
  /** Database configuration */
  database: {
    entityStore: 'stylerEntities';
    schema: typeof StylerEntity;
    version: number;
  };
  /** Entity handler instance */
  entityHandler: StylerEntityHandler;
  /** Lifecycle hooks */
  lifecycle: {
    afterCreate?: (nodeId: TreeNodeId, entity: StylerEntity) => Promise<void>;
    beforeDelete?: (nodeId: TreeNodeId, entity: StylerEntity) => Promise<void>;
    afterUpdate?: (nodeId: TreeNodeId, entity: StylerEntity) => Promise<void>;
  };
  /** UI containers */
  ui: {
    dialogComponent: React.ComponentType<StylerDialogProps>;
    panelComponent?: React.ComponentType<any>;
    iconComponent?: React.ComponentType<any>;
  };
  /** API extensions */
  api: {
    workerExtensions: Partial<StylerWorkerAPI>;
    clientExtensions?: Record<string, any>;
  };
}

/**
 * 🟡 Entity handler for Styler operations
 */
export interface StylerEntityHandler {
  // Core CRUD operations
  create(parentId: TreeNodeId, data: StylerFormData): Promise<StylerEntity>;
  read(nodeId: TreeNodeId): Promise<StylerEntity | undefined>;
  update(nodeId: TreeNodeId, updates: Partial<StylerEntity>): Promise<void>;
  delete(nodeId: TreeNodeId): Promise<void>;

  // Working copy operations
  createWorkingCopy(nodeId: TreeNodeId): Promise<StylerWorkingCopy>;
  commitWorkingCopy(workingCopyId: UUID): Promise<void>;
  discardWorkingCopy(workingCopyId: UUID): Promise<void>;

  // Validation
  validate(data: Partial<StylerFormData>): Promise<ValidationResult>;

  // Export/Import
  export(nodeId: TreeNodeId): Promise<any>;
  import(data: any, parentId: TreeNodeId): Promise<StylerEntity>;
}

// ================================================================================
// 🟡 Utility & Helper Interfaces
// ================================================================================

/**
 * 🟡 Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation errors by field */
  errors: Record<string, string[]>;
  /** Validation warnings */
  warnings: Record<string, string[]>;
}

/**
 * 🟡 Color calculation utilities
 */
export interface ColorCalculator {
  /** Calculate color for a value using linear algorithm */
  calculateLinear(value: number, min: number, max: number, config: StylerConfig): string;
  /** Calculate color for a value using logarithmic algorithm */
  calculateLogarithmic(value: number, min: number, max: number, config: StylerConfig): string;
  /** Calculate color for a value using quantile algorithm */
  calculateQuantile(value: number, values: number[], config: StylerConfig): string;
  /** Calculate color for a categorical value */
  calculateCategorical(
    value: string | number,
    categories: (string | number)[],
    config: StylerConfig
  ): string;
  /** Convert HSV to RGB */
  hsvToRgb(h: number, s: number, v: number): [number, number, number];
  /** Convert RGB to hex */
  rgbToHex(r: number, g: number, b: number): string;
}

/**
 * 🟡 File processing utilities
 */
export interface FileProcessor {
  /** Parse CSV content to table structure */
  parseCSV(content: string, delimiter?: string): ParseFileResult;
  /** Parse TSV content to table structure */
  parseTSV(content: string): ParseFileResult;
  /** Detect file encoding */
  detectEncoding(file: File): Promise<string>;
  /** Calculate SHA3 hash of file content */
  calculateSHA3Hash(content: string | ArrayBuffer): string;
  /** Validate file format */
  validateFileFormat(file: File): boolean;
}

/**
 * 🟡 Performance monitoring
 */
export interface PerformanceMetrics {
  /** File parsing time */
  parseTime: number;
  /** Style calculation time */
  calculationTime: number;
  /** PreviewStep rendering time */
  renderTime: number;
  /** Memory usage during processing */
  memoryUsage: number;
  /** Cache hit/miss statistics */
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

// ================================================================================
// 🟢 Error Types & Exception Interfaces
// ================================================================================

/**
 * 🟢 Styler specific error types
 */
export type StylerErrorType =
  | 'FILE_PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'CALCULATION_ERROR'
  | 'CACHE_ERROR'
  | 'NETWORK_ERROR'
  | 'WORKER_ERROR';

/**
 * 🟢 Styler error interface
 */
export interface StylerError extends Error {
  /** Error type */
  type: StylerErrorType;
  /** Error code for programmatic handling */
  code: string;
  /** Additional context data */
  context?: Record<string, any>;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested recovery actions */
  recoveryActions?: string[];
}

// ================================================================================
// 🟡 Configuration & Settings Interfaces
// ================================================================================

/**
 * 🟡 Styler plugin configuration
 */
export interface StylerPluginConfig {
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Cache expiration time in milliseconds */
  cacheExpirationTime: number;
  /** Maximum number of cached files */
  maxCacheEntries: number;
  /** Default color mapping algorithm */
  defaultAlgorithm: ColorMappingAlgorithm;
  /** Default color space */
  defaultColorSpace: ColorSpace;
  /** Performance settings */
  performance: {
    /** Debounce time for preview updates */
    debounceTime: number;
    /** Chunk size for large file processing */
    chunkSize: number;
    /** Maximum concurrent operations */
    maxConcurrentOps: number;
  };
  /** UI settings */
  ui: {
    /** Enable step validation */
    enableStepValidation: boolean;
    /** Show advanced options */
    showAdvancedOptions: boolean;
    /** Default base-dialog size */
    defaultDialogSize: 'sm' | 'md' | 'lg' | 'xl';
  };
}

// ================================================================================
// Type Exports for External Use
// ================================================================================

export type {
  // Re-export commonly used types
  UUID,
  TreeNodeId,
  TreeNodeType,
  PrimaryResourceEntity,
};

// Default export with all interfaces
export default {
  // Core entities
  StylerEntity,
  TableMetadataEntity,
  RowEntity,
  StylerWorkingCopy,

  // Configuration
  StylerConfig,
  FilterRule,

  // UI State
  StylerFormData,
  StylerPreviewState,
  StylerDialogState,

  // API interfaces
  StylerWorkerAPI,
  StylerDB,
  StylerFileCacheService,

  // Component props
  StylerDialogProps,
  StylerConfigurationProps,
  StylerPreviewProps,

  // Plugin integration
  StylerNodeTypeDefinition,
  StylerEntityHandler,

  // Utilities
  ValidationResult,
  ColorCalculator,
  FileProcessor,
  PerformanceMetrics,

  // Error handling
  StylerError,

  // Configuration
  StylerPluginConfig,
};
