# StyleMap Plugin Data Model

This document describes the comprehensive data model for the StyleMap Plugin, including all entity types used for database storage, their relationships, and the CSV processing architecture.

## Overview

The StyleMap Plugin implements a sophisticated data visualization system with:
- **CSV/TSV processing pipeline**: Import → Parse → Analyze → Filter → Style
- **RelationalEntity pattern**: Shared table metadata with reference counting
- **Working Copy support**: Draft editing with commit/rollback
- **MapLibre integration**: Generated style properties for geographic visualization

## Database Architecture

### Database Structure

The StyleMap Plugin uses IndexedDB with the following entity structure:

```typescript
interface StyleMapDatabaseStructure {
  // Main StyleMap entities (PeerEntity)
  stylemaps: StyleMapEntity[];
  
  // Shared table metadata (RelationalEntity) 
  tableMetadata: TableMetadataEntity[];
  
  // Working copies for draft editing
  styleMapWorkingCopies: StyleMapWorkingCopy[];
}
```

### Indexing Strategy

```typescript
const indexConfiguration = {
  // Primary indices for core entities
  stylemaps: '&nodeId, name, createdAt, updatedAt, tableMetadataId',
  tableMetadata: '&id, contentHash, filename, referenceCount, lastAccessedAt',
  styleMapWorkingCopies: '&workingCopyId, workingCopyOf, copiedAt',
  
  // Performance indices for queries
  stylemapsByTable: '[tableMetadataId+nodeId]',
  tablesByHash: '[contentHash+filename]',
  workingCopiesByNode: '[workingCopyOf+copiedAt]',
};
```

## Entity Type Definitions

### Core Entities

#### StyleMapEntity (PeerEntity)
Main configuration entity with 1:1 correspondence to TreeNode.

```typescript
export interface StyleMapEntity extends PeerEntity {
  /**
   * Unique identifier for the StyleMap entity
   */
  id: EntityId;
  
  /**
   * Human-readable name for the StyleMap
   */
  name: string;
  
  /**
   * Optional description of the StyleMap
   */
  description?: string;
  
  /**
   * Reference to shared table metadata (RelationalEntity)
   */
  tableMetadataId?: string;
  
  /**
   * Filter rules applied to the data
   */
  filterRules: FilterRule[];
  
  /**
   * Selected key column for mapping
   */
  selectedKeyColumn: string;
  
  /**
   * Selected value columns for display
   */
  selectedValueColumns: string[];
  
  /**
   * Key-value transformation mappings
   */
  keyValueMappings: KeyValueMapping[];
  
  /**
   * Style configuration
   */
  styleMapConfig: StyleMapConfig;
  
  /**
   * Cache key for output styles
   */
  cacheKey?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}
```

#### TableMetadataEntity (RelationalEntity)
Shared table data with reference counting for memory efficiency.

```typescript
export interface TableMetadataEntity extends RelationalEntity {
  /**
   * Entity identifier (required for RelationalEntity)
   */
  id: EntityId;
  
  /**
   * Table identifier (for compatibility with database operations)
   */
  tableId?: string;
  
  /**
   * Import timestamp
   */
  importedAt?: number;
  
  /**
   * Version field (required for Entity pattern)
   */
  version: number;
  
  /**
   * Original filename
   */
  filename?: string;
  
  /**
   * URL if the file was downloaded
   */
  fileUrl?: string;
  
  /**
   * Raw file content (CSV/TSV)
   */
  fileContent?: string;
  
  /**
   * Content hash for deduplication
   */
  contentHash: string;
  
  /**
   * Parsed column headers
   */
  columns: string[];
  
  /**
   * Parsed data rows
   */
  tableRows: Array<Array<string | number>>;
  
  /**
   * File size in bytes
   */
  fileSizeBytes: number;
  
  /**
   * Total number of rows
   */
  totalRows: number;
  
  /**
   * Column statistics for optimization
   */
  columnStats?: Record<string, {
    uniqueValues: number;
    isNumeric: boolean;
    minValue?: number;
    maxValue?: number;
  }>;
  
  /**
   * Reference management for RelationalEntity
   */
  referenceCount: number;
  nodeIds: NodeId[];
  lastAccessedAt: number;
}
```

### Working Copy System

#### StyleMapWorkingCopy
Extends StyleMapEntity with working copy properties for draft editing.

```typescript
export interface WorkingCopyProperties {
  workingCopyId: string;
  workingCopyOf: string;
  copiedAt: number;
  isDirty: boolean;
}

export type StyleMapWorkingCopy = StyleMapEntity & WorkingCopyProperties;
```

### Configuration Types

#### FilterRule
Defines data filtering logic with multiple operators.

```typescript
export interface FilterRule {
  id: string;
  column: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with';
  value: string;
  enabled: boolean;
}
```

#### StyleMapConfig
Comprehensive style configuration for MapLibre integration.

```typescript
export interface StyleMapConfig {
  /**
   * Default colors for all elements
   */
  defaultColors: ColorScheme;
  
  /**
   * Value-specific color rules
   */
  colorRules?: ColorRule[];
  
  /**
   * Whether to use gradient colors for numeric values
   */
  useGradient?: boolean;
  
  /**
   * Whether to show a color legend
   */
  showLegend?: boolean;
  
  /**
   * Opacity level (0-1)
   */
  opacity?: number;
  
  /**
   * Additional style properties
   */
  customStyles?: Record<string, any>;
}

export interface ColorScheme {
  text: string;
  background: string;
  border: string;
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
}

export interface ColorRule {
  id: string;
  value: string;
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  enabled: boolean;
}
```

#### KeyValueMapping
Defines value transformations for data visualization.

```typescript
export interface KeyValueMapping {
  /**
   * Original key value
   */
  key: string;
  
  /**
   * Mapped value
   */
  value: string;
  
  /**
   * Optional display label
   */
  label?: string;
}
```

## Data Processing Architecture

### CSV Processing Pipeline

```typescript
interface CSVProcessingPipeline {
  // 1. File Upload and Validation
  fileUpload: {
    supportedFormats: ['.csv', '.tsv', '.xlsx', '.xls'];
    maxFileSize: number;
    validation: (file: File) => Promise<ValidationResult>;
  };
  
  // 2. Content Parsing
  parsing: {
    csvParser: (content: string, delimiter?: string) => ParsedData;
    columnAnalysis: (data: ParsedData) => ColumnMetadata[];
    statisticsGeneration: (data: ParsedData) => ColumnStats;
  };
  
  // 3. Data Storage
  storage: {
    contentHashing: (content: string) => Promise<string>;
    deduplication: (hash: string) => Promise<TableMetadataEntity | null>;
    tableCreation: (data: ParsedData) => Promise<TableMetadataEntity>;
  };
  
  // 4. Reference Management
  referenceManagement: {
    addReference: (tableId: EntityId, nodeId: NodeId) => Promise<void>;
    removeReference: (tableId: EntityId, nodeId: NodeId) => Promise<void>;
    cleanup: (tableId: EntityId) => Promise<void>;
  };
}
```

### Table Metadata Management

The plugin implements sophisticated table sharing through the RelationalEntity pattern:

```typescript
class TableMetadataManager {
  /**
   * Create or reuse existing table metadata
   */
  async getOrCreateTableMetadata(
    content: string, 
    filename: string, 
    nodeId: NodeId
  ): Promise<TableMetadataEntity> {
    const contentHash = await this.generateContentHash(content);
    
    // Check for existing table with same content
    const existing = await this.findByContentHash(contentHash);
    if (existing) {
      // Add reference to existing table
      await this.addReference(existing.id, nodeId);
      return existing;
    }
    
    // Create new table metadata
    return this.createTableMetadata(content, filename, nodeId);
  }
  
  /**
   * Remove reference and cleanup if needed
   */
  async removeReference(tableId: EntityId, nodeId: NodeId): Promise<void> {
    const table = await this.get(tableId);
    if (!table) return;
    
    // Remove node from references
    table.nodeIds = table.nodeIds.filter(id => id !== nodeId);
    table.referenceCount = table.nodeIds.length;
    
    if (table.referenceCount === 0) {
      // No more references, cleanup table
      await this.delete(tableId);
    } else {
      await this.update(table);
    }
  }
}
```

### Style Generation System

The plugin generates MapLibre-compatible styles based on data values:

```typescript
interface StyleGenerationPipeline {
  // 1. Data Analysis
  analysis: {
    valueExtraction: (data: TableData, keyColumn: string) => string[];
    typeDetection: (values: string[]) => 'numeric' | 'categorical' | 'text';
    statisticalAnalysis: (values: string[]) => ValueStatistics;
  };
  
  // 2. Color Mapping
  colorMapping: {
    gradientGeneration: (values: number[], colorScheme: ColorScheme) => ColorMap;
    categoricalMapping: (values: string[], colorRules: ColorRule[]) => ColorMap;
    customMapping: (mappings: KeyValueMapping[]) => ColorMap;
  };
  
  // 3. Style Output
  styleGeneration: {
    maplibreStyle: (colorMap: ColorMap, config: StyleMapConfig) => MapLibreStyle;
    legendGeneration: (colorMap: ColorMap) => LegendData;
    previewGeneration: (style: MapLibreStyle) => PreviewData;
  };
}
```

## Database Operations

### Entity Handler Implementation

```typescript
export class StyleMapEntityHandler extends PeerEntityHandler<StyleMapEntity> {
  private tableMetadataManager = new TableMetadataManager();
  
  async createEntity(nodeId: NodeId, data?: Partial<StyleMapEntity>): Promise<StyleMapEntity> {
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
  
  async deleteEntity(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (entity?.tableMetadataId) {
      // Remove reference to shared table
      await this.tableMetadataManager.removeReference(
        entity.tableMetadataId as EntityId, 
        nodeId
      );
    }
    
    await this.table.where('nodeId').equals(nodeId).delete();
  }
}
```

### Working Copy Operations

```typescript
interface WorkingCopyOperations {
  createWorkingCopy(nodeId: NodeId): Promise<StyleMapWorkingCopy>;
  updateWorkingCopy(workingCopyId: string, changes: Partial<StyleMapEntity>): Promise<void>;
  commitWorkingCopy(workingCopyId: string): Promise<StyleMapEntity>;
  discardWorkingCopy(workingCopyId: string): Promise<void>;
}
```

## Performance Optimizations

### Indexing Strategy
- **Content Hash Index**: Fast deduplication of identical tables
- **Reference Count Index**: Efficient cleanup operations
- **Column Statistics**: Pre-computed for fast style generation

### Memory Management
- **Lazy Loading**: Table data loaded only when needed
- **Reference Counting**: Automatic cleanup of unused tables
- **Working Copy Lifecycle**: Temporary data automatically cleaned up

### Caching Strategy
- **Style Cache**: Generated styles cached by configuration hash
- **Parse Cache**: Parsed table data cached for reuse
- **Statistics Cache**: Column analysis cached for performance

---

**Implementation Status**: Core entities defined, handlers partially implemented  
**Next Priority**: Complete TableMetadataManager and style generation pipeline  
**Performance Target**: Handle 100MB CSV files with sub-second style generation