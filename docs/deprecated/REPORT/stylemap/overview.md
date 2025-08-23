# StyleMap Plugin Overview

The StyleMap Plugin provides comprehensive CSV/TSV data visualization capabilities for HierarchiDB, enabling users to import tabular data, apply filters and transformations, and generate MapLibre-compatible styles for geographic visualization.

## Architecture Overview

The StyleMap Plugin follows HierarchiDB's 4-layer architecture with strict UI-Worker separation:

```
UI Layer (React Components) ←→ Comlink RPC ←→ Worker Layer (Processing) ←→ IndexedDB (Storage)
```

### Key Components

- **UI Layer**: Multi-step React dialog components for data import and configuration
- **Worker Layer**: CSV processing, data analysis, and style generation
- **Data Layer**: IndexedDB storage with shared table metadata (RelationalEntity pattern)
- **API Layer**: PluginAPI integration for seamless HierarchiDB integration

## Feature Overview

### 1. Data Import and Processing
- **File Upload**: Support for CSV, TSV, and planned Excel formats
- **URL Import**: Direct download from web sources
- **Column Analysis**: Automatic data type detection and statistical analysis
- **Data Validation**: File format validation and content verification

### 2. Data Management
The plugin implements a sophisticated data sharing system:

```typescript
interface TableMetadataEntity extends RelationalEntity {
  id: EntityId;
  tableId?: string;
  filename?: string;
  fileContent?: string;
  contentHash: string;        // For deduplication
  columns: string[];
  tableRows: Array<Array<string | number>>;
  referenceCount: number;     // RelationalEntity pattern
  nodeIds: NodeId[];         // Referencing StyleMaps
}
```

### 3. Filtering System
Advanced filtering capabilities with multiple operators:

```typescript
interface FilterRule {
  id: string;
  column: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with';
  value: string;
  enabled: boolean;
}
```

### 4. Style Configuration
Comprehensive style mapping for MapLibre integration:

```typescript
interface StyleMapConfig {
  defaultColors: ColorScheme;
  colorRules?: ColorRule[];
  useGradient?: boolean;
  showLegend?: boolean;
  opacity?: number;
}
```

## Processing Pipeline

The StyleMap Plugin implements a 6-step user workflow:

### Step 1: Basic Information
- Name and description for the StyleMap
- Initial configuration setup

### Step 2: File Upload
- File selection (CSV/TSV)
- URL-based import option
- File validation and preview

### Step 3: Data Filtering
- Apply filter rules to reduce dataset
- Preview filtered results
- Multiple filter combinations

### Step 4: Column Selection
- Select key and value columns for mapping
- Configure column mappings
- Data type verification

### Step 5: Color Settings
- Define color schemes and rules
- Configure gradient options
- Set opacity and visual properties

### Step 6: Preview
- Preview generated styles
- Final validation before creation
- MapLibre style output preview

## Data Storage Architecture

### Entity Relationships

```
StyleMapEntity (PeerEntity)
    ↓ references
TableMetadataEntity (RelationalEntity)
    ↓ managed by
TableMetadataManager
```

### Key Design Patterns

1. **RelationalEntity Pattern**: TableMetadataEntity is shared across multiple StyleMaps
2. **Reference Counting**: Automatic cleanup when no StyleMaps reference a table
3. **Working Copy Pattern**: Draft editing with commit/rollback support
4. **Content Hash Deduplication**: Prevents duplicate table storage

## Integration with HierarchiDB

The StyleMap Plugin seamlessly integrates with HierarchiDB's core systems:

- **Node Type System**: Registers as `'stylemap'` node type
- **Entity Handlers**: Implements `StyleMapEntityHandler` for database operations
- **Working Copy Pattern**: Supports draft editing and commit/rollback
- **Command Pattern**: All mutations go through CommandManager
- **Subscription System**: UI automatically updates on data changes

## Performance Characteristics

### CSV Processing
- **Streaming Parser**: Memory-efficient processing for large files
- **Incremental Analysis**: Progressive column analysis and statistics
- **Content Hash Caching**: Deduplication prevents reprocessing identical files

### Style Generation
- **On-Demand Generation**: Styles generated when needed
- **Cache Management**: Generated styles cached for performance
- **MapLibre Optimization**: Output optimized for MapLibre rendering

### Memory Management
- **RelationalEntity Cleanup**: Automatic table cleanup when unreferenced
- **Buffer Management**: Efficient handling of large datasets
- **Working Copy Lifecycle**: Temporary data automatically cleaned up

## API Integration

### PluginAPI Compliance
```typescript
const styleMapDefinition: PluginDefinition = {
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

### Worker Integration
- **CSV Processing**: Background parsing and analysis
- **Style Generation**: CPU-intensive color mapping operations
- **File Validation**: Security and format validation
- **Cache Management**: Efficient data caching strategies

## Security Considerations

### File Upload Security
- **Format Validation**: Strict file type checking
- **Content Scanning**: Malicious content detection
- **Size Limits**: Configurable file size restrictions
- **Sanitization**: Input data sanitization

### Data Privacy
- **Local Processing**: All data processed locally in IndexedDB
- **No External Dependencies**: Self-contained processing pipeline
- **User Control**: Full user control over data retention and deletion

## Extension Points

The StyleMap Plugin is designed for extensibility:

### Custom Data Sources
- Plugin interface for additional data sources
- Custom parsers for specialized formats
- API integration for external data services

### Style Customization
- Custom color algorithms
- Advanced mapping functions
- MapLibre style extensions

### Processing Pipeline
- Custom filter operators
- Advanced data transformations
- Export format extensions

## Future Roadmap

### Phase 1 Completion (Current)
- Complete UI implementation
- Finish CSV processing pipeline
- Implement style generation engine

### Phase 2 Enhancements
- Excel file support
- Advanced filtering options
- Performance optimizations

### Phase 3 Advanced Features
- Collaborative editing
- Real-time data updates
- Advanced visualization options

---

**Implementation Status**: ~60% Complete  
**Next Priority**: Complete CSV processing and style generation pipeline  
**Target Completion**: Q4 2025