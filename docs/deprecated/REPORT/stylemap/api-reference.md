# StyleMap Plugin API Reference

This document provides comprehensive API documentation for the StyleMap Plugin, including all interfaces, classes, methods, and integration points.

## Core API Overview

The StyleMap Plugin exposes its functionality through several API layers:

```
StyleMap API Architecture
├── Plugin Definition API (PluginAPI integration)
├── Entity Handler API (Database operations)
├── Manager API (Business logic)
├── Component API (UI integration)
└── Utility API (Helper functions)
```

## Plugin Definition API

### StyleMapPluginDefinition

Main plugin definition for HierarchiDB integration:

```typescript
interface StyleMapPluginDefinition extends PluginDefinition {
  nodeType: 'stylemap';
  displayName: 'StyleMap';
  database: DatabaseDefinition;
  entityHandler: StyleMapEntityHandler;
  lifecycle: NodeLifecycleHooks<StyleMapEntity, StyleMapWorkingCopy>;
  ui: UIPluginDefinition;
}

// Usage
const styleMapPlugin: StyleMapPluginDefinition = {
  nodeType: 'stylemap',
  displayName: 'StyleMap',
  database: {
    entityStore: 'stylemaps',
    schema: {
      '&nodeId': 'NodeId',
      'name, description': '',
      'createdAt, updatedAt': '',
      'version': '',
    },
    version: 1,
  },
  entityHandler: new StyleMapEntityHandler(),
  lifecycle: styleMapLifecycle,
  ui: {
    dialogComponent: () => import('./components/StyleMapDialog'),
    iconComponent: () => import('./components/StyleMapIcon'),
  },
};
```

### Plugin Registration

```typescript
// Register plugin with HierarchiDB
function registerStyleMapPlugin(): void {
  const registry = getPluginRegistry();
  registry.register(styleMapPlugin);
}

// Plugin initialization
function initializeStyleMapPlugin(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      registerStyleMapPlugin();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}
```

## Entity Handler API

### StyleMapEntityHandler

Primary entity handler for StyleMap operations:

```typescript
class StyleMapEntityHandler extends PeerEntityHandler<StyleMapEntity> {
  constructor(database: Database) {
    super(database, 'stylemaps');
  }

  /**
   * Create a new StyleMap entity
   */
  async createEntity(
    nodeId: NodeId, 
    data?: Partial<StyleMapEntity>
  ): Promise<StyleMapEntity> {
    const entity: StyleMapEntity = {
      id: crypto.randomUUID() as EntityId,
      nodeId,
      name: data?.name || 'Untitled StyleMap',
      description: data?.description,
      filterRules: data?.filterRules || [],
      selectedKeyColumn: data?.selectedKeyColumn || '',
      selectedValueColumns: data?.selectedValueColumns || [],
      keyValueMappings: data?.keyValueMappings || [],
      styleMapConfig: data?.styleMapConfig || this.getDefaultStyleConfig(),
      tableMetadataId: data?.tableMetadataId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    
    await this.table.add(entity);
    return entity;
  }

  /**
   * Update existing StyleMap entity
   */
  async updateEntity(
    nodeId: NodeId, 
    changes: Partial<StyleMapEntity>
  ): Promise<StyleMapEntity> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error('StyleMap entity not found');
    }
    
    const updated: StyleMapEntity = {
      ...existing,
      ...changes,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };
    
    await this.table.put(updated);
    return updated;
  }

  /**
   * Delete StyleMap entity and cleanup references
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
   * Get StyleMap entity by node ID
   */
  async getEntity(nodeId: NodeId): Promise<StyleMapEntity | null> {
    const entities = await this.table.where('nodeId').equals(nodeId).toArray();
    return entities[0] || null;
  }

  /**
   * List all StyleMap entities
   */
  async listEntities(): Promise<StyleMapEntity[]> {
    return this.table.orderBy('createdAt').reverse().toArray();
  }

  /**
   * Search StyleMap entities by criteria
   */
  async searchEntities(criteria: {
    name?: string;
    description?: string;
    tableMetadataId?: string;
  }): Promise<StyleMapEntity[]> {
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
  private getDefaultStyleConfig(): StyleMapConfig {
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
    // This is a simplified version
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
   * Generate MapLibre styles for StyleMap entity
   */
  async generateStyles(
    entity: StyleMapEntity,
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
    config: StyleMapConfig
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
    config: StyleMapConfig
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
    config: StyleMapConfig
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
  private generateCacheKey(entity: StyleMapEntity): string {
    const configData = {
      tableMetadataId: entity.tableMetadataId,
      filterRules: entity.filterRules,
      selectedKeyColumn: entity.selectedKeyColumn,
      selectedValueColumns: entity.selectedValueColumns,
      styleMapConfig: entity.styleMapConfig,
    };
    
    return btoa(JSON.stringify(configData));
  }
}
```

## Component APIs

### StyleMapDialog

Main dialog component for StyleMap creation:

```typescript
interface StyleMapDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (config: Partial<StyleMapEntity>) => void | Promise<void>;
  nodeId: NodeId;
  initialName?: string;
  initialDescription?: string;
}

interface StyleMapDialogState {
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
const StyleMapDialog: React.FC<StyleMapDialogProps> = (props) => {
  // Implementation
};

// Usage
<StyleMapDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onSubmit={handleStyleMapCreate}
  nodeId={currentNodeId}
  initialName="My StyleMap"
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
  styleMapConfig: StyleMapConfig;
  onStyleMapConfigChange: (config: StyleMapConfig) => void;
  previewData?: TableData;
}

// Step 6: Preview
interface Step6PreviewProps {
  styleMapConfig: StyleMapConfig;
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
    config: StyleMapConfig
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

### StyleMapError

```typescript
class StyleMapError extends Error {
  constructor(
    public type: StyleMapErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'StyleMapError';
  }
}

enum StyleMapErrorType {
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
interface StyleMapLifecycleHooks {
  beforeCreate?: (data: Partial<StyleMapEntity>) => Promise<void>;
  afterCreate?: (entity: StyleMapEntity) => Promise<void>;
  beforeUpdate?: (entity: StyleMapEntity, changes: Partial<StyleMapEntity>) => Promise<void>;
  afterUpdate?: (entity: StyleMapEntity) => Promise<void>;
  beforeDelete?: (entity: StyleMapEntity) => Promise<void>;
  afterDelete?: (nodeId: NodeId) => Promise<void>;
}
```

### Event Emitters

```typescript
interface StyleMapEvents {
  'entity:created': (entity: StyleMapEntity) => void;
  'entity:updated': (entity: StyleMapEntity) => void;
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