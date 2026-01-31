# Styler Plugin API Reference

This document provides comprehensive API documentation for the Styler Plugin, including all interfaces, classes, methods, and integration points.

## Core API Overview

The Styler Plugin exposes its functionality through several API layers:

```
Styler API Architecture
├── Plugin Definition API (PluginAPI integration)
├── Entity Handler API (Database operations)
├── Manager API (Business logic)
├── Component API (UI integration)
└── Utility API (Helper functions)
```

## Plugin Definition API

### StylerPluginDefinition

Main plugin definition for HierarchiDB integration:

```typescript
interface StylerPluginDefinition extends PluginDefinition {
  nodeType: 'styler-plugin';
  displayName: 'Styler';
  database: DatabaseDefinition;
  entityHandler: StylerEntityHandler;
  lifecycle: NodeLifecycleHooks<StylerEntity, StylerDraft>;
  ui: UIPluginDefinition;
}

// Usage
const stylerPlugin: StylerPluginDefinition = {
  nodeType: 'styler-plugin',
  displayName: 'Styler',
  database: {
    entityStore: 'stylers',
    schema: {
      '&nodeId': 'NodeId',
      'name, description': '',
      'createdAt, updatedAt': '',
      'version': '',
    },
    version: 1,
  },
  entityHandler: new StylerEntityHandler(),
  lifecycle: stylerLifecycle,
  ui: {
    dialogComponent: () => import('./components/StylerDialog'),
    iconComponent: () => import('./components/StylerIcon'),
  },
};
```

### Plugin Registration

```typescript
// Register plugin with HierarchiDB
function registerStylerPlugin(): void {
  const registry = getPluginRegistry();
  registry.register(stylerPlugin);
}

// Plugin initialization
function initializeStylerPlugin(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      registerStylerPlugin();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}
```

## Entity Handler API

### StylerEntityHandler

Primary entity handler for Styler operations:

```typescript
class StylerEntityHandler extends PeerEntityHandler<StylerEntity> {
  constructor(database: Database) {
    super(database, 'stylers');
  }

  /**
   * Create a new Styler entity
   */
  async createEntity(
    nodeId: NodeId, 
    data?: Partial<StylerEntity>
  ): Promise<StylerEntity> {
    const entity: StylerEntity = {
      id: crypto.randomUUID() as EntityId,
      nodeId,
      name: data?.name || 'Untitled Styler',
      description: data?.description,
      filterRules: data?.filterRules || [],
      selectedKeyColumn: data?.selectedKeyColumn || '',
      selectedValueColumns: data?.selectedValueColumns || [],
      keyValueMappings: data?.keyValueMappings || [],
      stylerConfig: data?.stylerConfig || this.getDefaultStyleConfig(),
      tableMetadataId: data?.tableMetadataId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    
    await this.table.add(entity);
    return entity;
  }

  /**
   * Update existing Styler entity
   */
  async updateEntity(
    nodeId: NodeId, 
    changes: Partial<StylerEntity>
  ): Promise<StylerEntity> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error('Styler entity not found');
    }
    
    const updated: StylerEntity = {
      ...existing,
      ...changes,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };
    
    await this.table.put(updated);
    return updated;
  }

  /**
   * Delete Styler entity and cleanup references
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (entity?.tableMetadataId) {
      const tableManager = new TableMetadataManager();
      await tableManager.removeReference(
        entity.tableMetadataId as EntityId, 
        nodeId
      );
    }
    
    await this.table.where('nodeId').equals(nodeId).delete();
  }

  /**
   * Get Styler entity by node ID
   */
  async getEntity(nodeId: NodeId): Promise<StylerEntity | null> {
    const entities = await this.table.where('nodeId').equals(nodeId).toArray();
    return entities[0] || null;
  }

  /**
   * List all Styler entities
   */
  async listEntities(): Promise<StylerEntity[]> {
    return this.table.orderBy('createdAt').reverse().toArray();
  }

  /**
   * Search Styler entities by criteria
   */
  async searchEntities(criteria: {
    name?: string;
    description?: string;
    tableMetadataId?: string;
  }): Promise<StylerEntity[]> {
    let query = this.table.toCollection();
    
    if (criteria.name) {
      query = query.filter(entity => 
        entity.name.toLowerCase().includes(criteria.name!.toLowerCase())
      );
    }
    
    if (criteria.description) {
      query = query.filter(entity => 
        entity.description?.toLowerCase().includes(criteria.description!.toLowerCase())
      );
    }
    
    if (criteria.tableMetadataId) {
      query = query.filter(entity => entity.tableMetadataId === criteria.tableMetadataId);
    }
    
    return query.toArray();
  }

  /**
   * Get default style configuration
   */
  private getDefaultStyleConfig(): StylerConfig {
    return {
      defaultColors: {
        text: '#000000',
        background: '#ffffff',
        border: '#cccccc',
      },
      colorRules: [],
      useGradient: false,
      showLegend: true,
      opacity: 0.8,
    };
  }
}
```

## Manager APIs

### TableMetadataManager

Manages shared table metadata with reference counting:

```typescript
class TableMetadataManager {
  constructor(private database: Database) {
    this.table = database.tableMetadata;
  }

  /**
   * Get or create table metadata (with deduplication)
   */
  async getOrCreateTableMetadata(
    content: string,
    filename: string,
    nodeId: NodeId
  ): Promise<TableMetadataEntity> {
    const contentHash = await this.generateContentHash(content);
    
    // Check for existing table
    const existing = await this.findByContentHash(contentHash);
    if (existing) {
      await this.addReference(existing.id, nodeId);
      return existing;
    }
    
    // Create new table
    return this.createTableMetadata(content, filename, nodeId);
  }

  /**
   * Generate SHA-256 hash of content
   */
  async generateContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Find table by content hash
   */
  async findByContentHash(hash: string): Promise<TableMetadataEntity | null> {
    const tables = await this.table.where('contentHash').equals(hash).toArray();
    return tables[0] || null;
  }

  /**
   * Add reference to table
   */
  async addReference(tableId: EntityId, nodeId: NodeId): Promise<void> {
    const table = await this.table.get(tableId);
    if (!table) return;
    
    if (!table.nodeIds.includes(nodeId)) {
      table.nodeIds.push(nodeId);
      table.referenceCount = table.nodeIds.length;
      table.lastAccessedAt = Date.now();
      
      await this.table.put(table);
    }
  }

  /**
   * Remove reference from table
   */
  async removeReference(tableId: EntityId, nodeId: NodeId): Promise<void> {
    const table = await this.table.get(tableId);
    if (!table) return;
    
    table.nodeIds = table.nodeIds.filter(id => id !== nodeId);
    table.referenceCount = table.nodeIds.length;
    
    if (table.referenceCount === 0) {
      await this.table.delete(tableId);
    } else {
      await this.table.put(table);
    }
  }

  /**
   * Create new table metadata
   */
  private async createTableMetadata(
    content: string,
    filename: string,
    nodeId: NodeId
  ): Promise<TableMetadataEntity> {
    const parsedData = await this.parseCSV(content);
    const contentHash = await this.generateContentHash(content);
    
    const tableMetadata: TableMetadataEntity = {
      id: crypto.randomUUID() as EntityId,
      tableId: crypto.randomUUID(),
      filename,
      fileContent: content,
      contentHash,
      columns: parsedData.headers,
      tableRows: parsedData.rows,
      fileSizeBytes: content.length,
      totalRows: parsedData.rows.length,
      referenceCount: 1,
      nodeIds: [nodeId],
      lastAccessedAt: Date.now(),
      importedAt: Date.now(),
      version: 1,
    };
    
    await this.table.add(tableMetadata);
    return tableMetadata;
  }

  /**
   * Parse CSV content
   */
  private async parseCSV(content: string): Promise<ParsedData> {
    // Implementation depends on CSV parsing library
    // This is a extracted version
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));
    
    return { headers, rows };
  }
}
```

### StyleGenerationManager

Manages style generation and caching:

```typescript
class StyleGenerationManager {
  constructor(
    private database: Database,
    private cache: StyleCacheManager
  ) {}

  /**
   * Generate MapLibre styles for Styler entity
   */
  async generateStyles(
    entity: StylerEntity,
    tableData: TableData
  ): Promise<MapLibreStyle> {
    // Check cache first
    const cacheKey = this.generateCacheKey(entity);
    const cached = await this.cache.getCachedStyle(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    // Generate new styles
    const styles = await this.generateMapLibreStyles(entity, tableData);
    
    // Cache result
    await this.cache.cacheStyle(cacheKey, styles);
    
    return styles;
  }

  /**
   * Generate color mapping from data
   */
  async generateColorMapping(
    values: (string | number)[],
    config: StylerConfig
  ): Promise<ColorMapping> {
    if (config.useGradient && this.isNumericData(values)) {
      return this.generateGradientMapping(values as number[], config);
    } else {
      return this.generateCategoricalMapping(values as string[], config);
    }
  }

  /**
   * Generate gradient color mapping for numeric data
   */
  private generateGradientMapping(
    values: number[],
    config: StylerConfig
  ): ColorMapping {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    const mapping: ColorMapping = new Map();
    
    values.forEach(value => {
      const ratio = (value - min) / range;
      const color = this.interpolateColor(
        config.defaultColors.background,
        config.defaultColors.text,
        ratio
      );
      mapping.set(String(value), color);
    });
    
    return mapping;
  }

  /**
   * Generate categorical color mapping
   */
  private generateCategoricalMapping(
    values: string[],
    config: StylerConfig
  ): ColorMapping {
    const uniqueValues = [...new Set(values)];
    const mapping: ColorMapping = new Map();
    
    uniqueValues.forEach((value, index) => {
      // Check for custom rule first
      const customRule = config.colorRules?.find(rule => rule.value === value);
      if (customRule) {
        mapping.set(value, customRule.color);
      } else {
        // Generate color based on index
        const hue = (index * 360) / uniqueValues.length;
        const color = `hsl(${hue}, 70%, 50%)`;
        mapping.set(value, color);
      }
    });
    
    return mapping;
  }

  /**
   * Generate cache key for configuration
   */
  private generateCacheKey(entity: StylerEntity): string {
    const configData = {
      tableMetadataId: entity.tableMetadataId,
      filterRules: entity.filterRules,
      selectedKeyColumn: entity.selectedKeyColumn,
      selectedValueColumns: entity.selectedValueColumns,
      stylerConfig: entity.stylerConfig,
    };
    
    return btoa(JSON.stringify(configData));
  }
}
```

## Component APIs

### StylerDialog

Main dialog component for Styler creation:

```typescript
interface StylerDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (config: Partial<StylerEntity>) => void | Promise<void>;
  nodeId: NodeId;
  initialName?: string;
  initialDescription?: string;
}

interface StylerDialogState {
  activeStep: number;
  isSubmitting: boolean;
  name: string;
  description: string;
  tableMetadata: TableMetadataEntity | null;
  filterRules: FilterRule[];
  columnMappings: KeyValueMapping[];
  previewData: PreviewData | null;
}

// Component API
const StylerDialog: React.FC<StylerDialogProps> = (props) => {
  // Implementation
};

// Usage
<StylerDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onSubmit={handleStylerCreate}
  nodeId={currentNodeId}
  initialName="My Styler"
/>
```

### Step Components

Each step component has a consistent API pattern:

```typescript
// Step 1: Basic Information
interface Step1BasicInformationProps {
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  nameError?: string;
  descriptionError?: string;
}

// Step 2: File Upload  
interface Step2FileUploadProps {
  onFileSelect: (file: File) => void;
  onUrlImport: (url: string) => Promise<void>;
  isLoading: boolean;
  error?: string;
  acceptedFormats: string[];
}

// Step 3: Filter Settings
interface Step3FilterSettingsProps {
  filterRules: FilterRule[];
  availableColumns: string[];
  onFilterRulesChange: (rules: FilterRule[]) => void;
  previewData?: TableData;
}

// Step 4: Column Selection
interface Step4ColumnSelectionProps {
  columns: string[];
  selectedKeyColumn: string;
  selectedValueColumns: string[];
  keyValueMappings: KeyValueMapping[];
  onKeyColumnChange: (column: string) => void;
  onValueColumnsChange: (columns: string[]) => void;
  onKeyValueMappingsChange: (mappings: KeyValueMapping[]) => void;
}

// Step 5: Color Settings
interface Step5ColorSettingsProps {
  stylerConfig: StylerConfig;
  onStylerConfigChange: (config: StylerConfig) => void;
  previewData?: TableData;
}

// Step 6: Preview
interface Step6PreviewProps {
  stylerConfig: StylerConfig;
  tableData: TableData;
  filterRules: FilterRule[];
  onGeneratePreview: () => Promise<PreviewResult>;
}
```

## Utility APIs

### CSV Processing Utilities

```typescript
interface CSVParser {
  /**
   * Parse CSV content with options
   */
  parseCSV(
    content: string, 
    options?: {
      delimiter?: string;
      hasHeader?: boolean;
      encoding?: string;
    }
  ): Promise<ParsedData>;

  /**
   * Analyze column data types and statistics
   */
  analyzeColumns(data: ParsedData): Promise<ColumnMetadata[]>;

  /**
   * Validate CSV format
   */
  validateFormat(content: string): ValidationResult;
}

// Usage
const parser = new CSVParser();
const data = await parser.parseCSV(fileContent, { delimiter: ',' });
const columns = await parser.analyzeColumns(data);
```

### Filter Engine

```typescript
interface FilterEngine {
  /**
   * Apply filter rules to table data
   */
  applyFilters(
    data: TableData, 
    rules: FilterRule[]
  ): Promise<TableData>;

  /**
   * Test if a row matches filter rules
   */
  matchesFilters(
    row: TableRow, 
    rules: FilterRule[], 
    columns: string[]
  ): boolean;

  /**
   * Optimize filter rules for performance
   */
  optimizeFilters(rules: FilterRule[]): FilterRule[];
}

// Usage
const filterEngine = new FilterEngine();
const filteredData = await filterEngine.applyFilters(tableData, filterRules);
```

### Style Generation Utilities

```typescript
interface StyleUtils {
  /**
   * Generate MapLibre style from configuration
   */
  generateMapLibreStyle(
    colorMapping: ColorMapping,
    config: StylerConfig
  ): MapLibreStyle;

  /**
   * Interpolate between two colors
   */
  interpolateColor(
    startColor: string,
    endColor: string,
    ratio: number
  ): string;

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex: string): RGBColor;

  /**
   * Convert RGB to hex color
   */
  rgbToHex(rgb: RGBColor): string;

  /**
   * Generate accessible color palette
   */
  generateAccessiblePalette(
    baseColor: string,
    count: number
  ): string[];
}
```

## Error Types

### StylerError

```typescript
class StylerError extends Error {
  constructor(
    public type: StylerErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'StylerError';
  }
}

enum StylerErrorType {
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_COLUMN = 'INVALID_COLUMN',
  INVALID_CONFIG = 'INVALID_CONFIG',
  CACHE_ERROR = 'CACHE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}
```

## Events and Hooks

### Lifecycle Hooks

```typescript
interface StylerLifecycleHooks {
  beforeCreate?: (data: Partial<StylerEntity>) => Promise<void>;
  afterCreate?: (entity: StylerEntity) => Promise<void>;
  beforeUpdate?: (entity: StylerEntity, changes: Partial<StylerEntity>) => Promise<void>;
  afterUpdate?: (entity: StylerEntity) => Promise<void>;
  beforeDelete?: (entity: StylerEntity) => Promise<void>;
  afterDelete?: (nodeId: NodeId) => Promise<void>;
}
```

### Event Emitters

```typescript
interface StylerEvents {
  'entity:created': (entity: StylerEntity) => void;
  'entity:updated': (entity: StylerEntity) => void;
  'entity:deleted': (nodeId: NodeId) => void;
  'table:imported': (table: TableMetadataEntity) => void;
  'table:cleaned': (tableId: EntityId) => void;
  'style:generated': (style: MapLibreStyle) => void;
  'style:cached': (cacheKey: string) => void;
}
```

---

**API Status**: Core APIs defined, implementation in progress  
**Next Priority**: Complete manager APIs and utility functions  
**Integration**: Full compatibility with HierarchiDB PluginAPI system