# StyleMap Plugin Implementation Guide

This document provides a comprehensive guide for implementing and extending the StyleMap Plugin, including development roadmap, current status, and implementation priorities.

## Implementation Overview

The StyleMap Plugin is currently in active development with approximately **60% completion**. The plugin follows HierarchiDB's plugin architecture and implements a comprehensive CSV/TSV data visualization system.

### Current Implementation Status

```
Phase 1: Core Architecture ✅ 95% Complete
├── Entity definitions ✅ 100%
├── Type system ✅ 100% 
├── Plugin registration ✅ 95%
└── Database schema ✅ 90%

Phase 2: Data Processing 🔄 40% Complete
├── CSV parsing ✅ 80%
├── Table metadata management 🔄 50%
├── Filter engine ✅ 70%
└── Style generation 🔄 20%

Phase 3: User Interface 🔄 65% Complete
├── Dialog components ✅ 80%
├── Step components 🔄 60%
├── View components 🔄 40%
└── Editor components 📋 10%

Phase 4: Integration ⏳ 30% Complete
├── MapLibre integration 📋 20%
├── Performance optimization 📋 0%
├── Testing ⏳ 40%
└── Documentation ✅ 85%
```

Legend: ✅ Complete | 🔄 In Progress | ⏳ Planned | 📋 Not Started

## Development Roadmap

### Phase 1: Core Foundation (Complete)

**Objective**: Establish plugin architecture and entity system
**Duration**: Completed in previous development cycles

**Completed Items:**
- ✅ StyleMapEntity and TableMetadataEntity definitions
- ✅ RelationalEntity pattern implementation
- ✅ Working Copy support
- ✅ Plugin registration and lifecycle hooks
- ✅ Basic TypeScript type system

### Phase 2: Data Processing (Current Focus)

**Objective**: Complete CSV processing pipeline and table management
**Target Completion**: Current development cycle

**Priority 1 - Critical (Complete First):**
```typescript
// 1. TableMetadataManager completion
class TableMetadataManager {
  // ✅ Implemented
  async getOrCreateTableMetadata(content: string, filename: string, nodeId: NodeId): Promise<TableMetadataEntity>
  
  // 🔄 In Progress
  async generateContentHash(content: string): Promise<string>
  async findByContentHash(hash: string): Promise<TableMetadataEntity | null>
  
  // 📋 Todo
  async addReference(tableId: EntityId, nodeId: NodeId): Promise<void>
  async removeReference(tableId: EntityId, nodeId: NodeId): Promise<void>
  async cleanup(): Promise<void>
}
```

**Priority 2 - CSV Processing Pipeline:**
```typescript
// 2. CSV Parser enhancement
interface CSVParser {
  // ✅ Basic implementation exists
  parseCSV(content: string, delimiter?: string): ParsedData
  
  // 📋 Todo
  analyzeColumns(data: ParsedData): ColumnMetadata[]
  generateStatistics(data: ParsedData): ColumnStats
  validateFormat(content: string): ValidationResult
}
```

**Priority 3 - Filter Engine:**
```typescript
// 3. Filter Engine completion
class FilterEngine {
  // ✅ Basic operators implemented
  applyFilter(data: TableData, rule: FilterRule): TableData
  
  // 📋 Todo
  optimizeFilters(rules: FilterRule[]): FilterRule[]
  createFilterIndex(data: TableData, column: string): FilterIndex
  streamingFilter(dataStream: ReadableStream, rules: FilterRule[]): ReadableStream
}
```

### Phase 3: User Interface (Ongoing)

**Objective**: Complete multi-step dialog and view components
**Target Completion**: Next development cycle

**Priority 1 - Step Components:**
```typescript
// Current status of step components:

// ✅ Step1BasicInformation - Complete
// 🔄 Step2FileUpload - Partial (FileInputWithUrl dependency missing)
// ✅ Step3FilterSettings - Complete structure, needs integration
// 🔄 Step4ColumnSelection - Partial (KeyValueMapping type issues)
// 📋 Step5ColorSettings - Basic structure only
// 📋 Step6Preview - Basic structure only
```

**Implementation Tasks:**
1. **Complete Step2FileUpload**:
   - Implement or replace FileInputWithUrl component
   - Add drag & drop functionality
   - Implement URL import feature
   - Add file validation

2. **Fix Step4ColumnSelection**:
   - Resolve KeyValueMapping type issues
   - Add column type detection
   - Implement mapping validation

3. **Implement Step5ColorSettings**:
   - Color picker integration
   - Gradient generation
   - Rule-based color mapping
   - Preview functionality

4. **Implement Step6Preview**:
   - Style generation preview
   - MapLibre integration
   - Final validation
   - Export functionality

**Priority 2 - View Components:**
```typescript
// 📋 StyleMapView - Basic structure exists, needs implementation
// 📋 StyleMapPanel - Basic structure exists, needs implementation  
// 📋 StyleMapEditor - Not implemented
// 📋 StyleMapPreview - Not implemented
```

### Phase 4: Style Generation Engine

**Objective**: Implement MapLibre style generation system
**Target Completion**: Future development cycle

**Core Requirements:**
```typescript
interface StyleGenerationEngine {
  // Generate MapLibre-compatible styles
  generateMapLibreStyle(
    tableData: TableData,
    config: StyleMapConfig,
    keyColumn: string,
    valueColumns: string[]
  ): Promise<MapLibreStyle>;
  
  // Color mapping algorithms
  generateColorMapping(
    values: (string | number)[],
    colorScheme: ColorScheme,
    useGradient: boolean
  ): ColorMapping;
  
  // Legend generation
  generateLegend(
    colorMapping: ColorMapping,
    config: StyleMapConfig
  ): LegendData;
  
  // Performance optimization
  cacheStyle(
    configHash: string,
    style: MapLibreStyle
  ): Promise<void>;
}
```

**Implementation Steps:**
1. **Color Algorithm Implementation**:
   - Gradient generation for numeric data
   - Categorical color assignment
   - Custom color rule application
   - Color accessibility validation

2. **MapLibre Integration**:
   - Style property generation
   - Layer configuration
   - Source data formatting
   - Performance optimization

3. **Caching System**:
   - Style cache implementation
   - Hash-based invalidation
   - Memory management
   - Persistence strategy

## Technical Implementation Details

### Database Operations

**Current Issues to Resolve:**
```typescript
// 1. TableMetadataEntity missing properties
interface TableMetadataEntity extends RelationalEntity {
  // ✅ Added in recent fixes
  id: EntityId;
  tableId?: string;
  importedAt?: number;
  version: number;
  
  // 📋 Still need to implement
  // Proper IndexedDB integration
  // Reference counting logic
  // Cleanup operations
}
```

**Next Steps:**
1. Complete TableMetadataManager implementation
2. Fix remaining TypeScript errors
3. Implement proper error handling
4. Add performance monitoring

### Error Resolution Priority

**Critical TypeScript Errors (Must Fix First):**
```bash
# Current error count: ~80 errors remaining

# Priority 1: Missing dependencies
- @hierarchidb/ui-file exports ⚠️ 
- @hierarchidb/worker exports ⚠️
- Missing utility functions ⚠️

# Priority 2: Type mismatches  
- KeyValueMapping type issues ⚠️
- Undefined type access ⚠️
- Property missing errors ⚠️

# Priority 3: Implementation gaps
- Unimplemented methods ⚠️
- Missing handlers ⚠️
- Integration issues ⚠️
```

### Testing Strategy

**Test Implementation Plan:**
```typescript
// Phase 1: Unit Tests
describe('StyleMap Core', () => {
  // Entity operations
  test('StyleMapEntity creation and validation');
  test('TableMetadataEntity reference counting');
  test('Working copy lifecycle');
  
  // Data processing
  test('CSV parsing with various formats');
  test('Filter rule application');
  test('Column analysis and statistics');
});

// Phase 2: Integration Tests  
describe('StyleMap Integration', () => {
  // UI workflow
  test('Complete dialog workflow');
  test('Step navigation and validation');
  test('Data persistence');
  
  // Database operations
  test('Entity handler operations');
  test('Reference management');
  test('Cleanup operations');
});

// Phase 3: Performance Tests
describe('StyleMap Performance', () => {
  test('Large CSV file processing');
  test('Style generation performance');
  test('Memory usage optimization');
});
```

## Development Environment Setup

### Prerequisites
```bash
# Required packages
npm install @hierarchidb/core @hierarchidb/worker @hierarchidb/ui-core

# Development dependencies
npm install --save-dev vitest @testing-library/react

# Optional: CSV processing libraries
npm install papaparse xlsx
```

### Build and Test Commands
```bash
# Development
pnpm dev --filter @hierarchidb/stylemap

# Type checking
pnpm typecheck --filter @hierarchidb/stylemap

# Testing
pnpm test --filter @hierarchidb/stylemap

# Build
pnpm build --filter @hierarchidb/stylemap
```

### Development Workflow

**Daily Development Process:**
1. **Fix TypeScript Errors**: Start each session by resolving compilation errors
2. **Implement Core Features**: Focus on data processing and UI components
3. **Add Tests**: Write tests for implemented features
4. **Update Documentation**: Keep documentation in sync with implementation

**Code Quality Checklist:**
- [ ] All TypeScript errors resolved
- [ ] Tests passing for implemented features  
- [ ] Documentation updated
- [ ] Performance considerations addressed
- [ ] Accessibility requirements met

## Performance Targets

### Processing Performance
- **CSV Parsing**: Handle 50MB files in <5 seconds
- **Style Generation**: Generate styles for 100K data points in <2 seconds
- **UI Responsiveness**: Maintain 60fps during interactions
- **Memory Usage**: Keep peak usage under 500MB for large datasets

### Implementation Strategies
```typescript
// 1. Streaming processing for large files
async function* processLargeCSV(file: File): AsyncGenerator<ProcessedChunk> {
  const reader = file.stream().getReader();
  const parser = new StreamingCSVParser();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    yield* parser.processChunk(value);
  }
}

// 2. Web Worker integration
class StyleMapWorker {
  async generateStyles(data: TableData, config: StyleMapConfig): Promise<MapLibreStyle> {
    // Offload CPU-intensive operations to Web Worker
    return this.worker.postMessage({ type: 'GENERATE_STYLES', data, config });
  }
}

// 3. Progressive loading
function useProgressiveTableData(tableId: string) {
  // Load data in chunks to maintain UI responsiveness
  const [data, setData] = useState<TableData>({ headers: [], rows: [] });
  
  useEffect(() => {
    loadTableDataProgressive(tableId, (chunk) => {
      setData(prev => ({ ...prev, rows: [...prev.rows, ...chunk.rows] }));
    });
  }, [tableId]);
  
  return data;
}
```

## Extension Points

### Custom Data Sources
```typescript
interface DataSourcePlugin {
  name: string;
  supportedFormats: string[];
  parser: (content: string) => Promise<ParsedData>;
  validator: (content: string) => ValidationResult;
}

// Register custom data source
styleMapPlugin.registerDataSource(new ExcelDataSource());
styleMapPlugin.registerDataSource(new JSONDataSource());
```

### Custom Style Algorithms
```typescript
interface StyleAlgorithm {
  name: string;
  description: string;
  generateColors: (values: any[], config: any) => ColorMapping;
}

// Register custom algorithm
styleMapPlugin.registerStyleAlgorithm(new HeatmapAlgorithm());
styleMapPlugin.registerStyleAlgorithm(new ClusteringAlgorithm());
```

---

**Development Priority**: Complete Phase 2 (Data Processing) and Phase 3 (UI) in parallel  
**Next Milestone**: Full CSV processing pipeline with working UI  
**Success Criteria**: Successfully import and visualize 10MB CSV file with custom styling