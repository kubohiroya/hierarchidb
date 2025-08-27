# Shape Plugin for HierarchiDB

Geographic shape data management plugin implementing 3-layer architecture with sophisticated error handling and batch processing capabilities.

## Overview

The Shape Plugin enables HierarchiDB to handle geographic shape data from sources like Natural Earth, supporting batch processing workflows from download to vector tile generation. Originally migrated from ERIA-Cartograph project, it now integrates seamlessly with HierarchiDB's plugin architecture.

## Features

- **Multi-Source Geographic Data**: Support for Natural Earth, OpenStreetMap, and custom data sources
- **Batch Processing Pipeline**: Automated download → feature processing → simplification → vector tile generation
- **3-Tier Error Management**: Memory-based task errors, session-scoped aggregated errors, persistent statistics
- **Recovery & Resume**: Failed batch operations can be restarted from checkpoint data
- **Interactive UI**: Step-by-step data configuration with country selection and license agreement
- **Real-time Monitoring**: Progress tracking and error reporting during batch operations

## Architecture

### 3-Layer Plugin Architecture

```
UI Layer (React Components)
├── ShapeDialog.tsx - Main configuration dialog
├── ShapePanel.tsx - Tree node panel
├── BatchProgressSplitView.tsx - Monitoring interface
└── ErrorReportPanel.tsx - Error display and recovery

Worker Layer (Background Processing)
├── ShapeEntityHandler.ts - Database operations
├── BatchSessionManager.ts - Workflow orchestration  
├── WorkerPool.ts - Concurrent processing
└── ErrorStateManager.ts - Error tracking

Shared Layer (Common Types & APIs)
├── ShapeEntity.ts - Data structures
├── BatchConfig.ts - Configuration types
└── ShapeAPI.ts - Interface contracts
```

### Database Schema

**CoreDB (Persistent)**:
```typescript
// Shape entity data
shapeEntities: "++id, nodeId, dataSourceName, licenseAgreement, checkboxState, batchConfig"

// Batch task tracking  
batchTasks: "taskId, treeNodeId, type, stage, continent, [treeNodeId+stage]"

// Buffer storage
batchBuffers: "taskId, treeNodeId"

// Session statistics (C-tier errors)
sessionStats: "++id, sessionId, treeNodeId, startTime, totalErrors, status"
```

**EphemeralDB (Session-scoped)**:
```typescript
// Aggregated error data (B-tier)
aggregatedErrors: "pattern, occurrences, firstSeen, lastSeen, affectedTasks[]"

// Temporary processing buffers
processingBuffers: "taskId, data, timestamp"
```

## Error Management System

### 3-Tier Error Architecture

**A) Task-level Errors (Memory-only)**
- Individual task failures stored in memory Map structures
- Immediately aggregated to B-tier, no persistence required
- Cleared on page refresh, optimized for high-frequency errors

```typescript
interface TaskError {
  taskId: string;
  type: string;
  message: string;
  timestamp: number;
  retryCount: number;
}
```

**B) Aggregated Errors (EphemeralDB)**
- Pattern-based error aggregation stored in session IndexedDB
- Survives page refresh, cleared on browser close
- Enables batch processing resume functionality

```typescript
interface AggregatedError {
  pattern: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  affectedTasks: string[]; // 未完了タスクリスト
}
```

**C) Session Statistics (Persistent)**
- Long-term error statistics in permanent IndexedDB
- Historical analysis and reporting
- Survives browser restarts

```typescript
interface SessionStatsEntity {
  sessionId: string;
  treeNodeId: string;
  totalErrors: number;
  resolvedErrors: number;
  status: 'active' | 'completed' | 'failed';
}
```

### Recovery & Resume

The plugin supports resuming failed batch operations:

1. **Checkpoint Detection**: B-tier aggregated errors contain `affectedTasks[]` list
2. **Resume Process**: Extract incomplete tasks from EphemeralDB on session restart  
3. **Queue Reconstruction**: Add failed tasks to new batch processing queue
4. **Status Tracking**: Monitor recovery progress through existing UI components

## Batch Processing Pipeline

### 1. Download Session
- Concurrent download of geographic data files
- CORS proxy integration for cross-origin requests
- Configurable concurrency limits and retry logic

### 2. Feature Processing (Simplify1)
- Feature filtering based on area thresholds
- Hybrid filtering algorithm with multiple strategies
- Vertex count optimization and aspect ratio analysis

### 3. Tile Processing (Simplify2) 
- Geographic simplification using Turf.js
- Per-feature simplification with tolerance settings
- Quantization for file size optimization

### 4. Vector Tile Generation
- PMTiles format generation for efficient serving
- Zoom-level based tile generation
- Tile count thresholds to prevent excessive generation

## Configuration

### Batch Configuration Structure

```typescript
interface BatchConfig {
  // Common settings
  corsProxyBaseURL: string;
  dataSource: 'naturalearth' | 'openstreetmap';
  
  // Session-specific configurations
  download: {
    concurrentDownloads: number;
    deleteOnComplete: boolean;
  };
  
  simplify1: {
    concurrentProcesses: number;
    enableFeatureFiltering: boolean;
    featureAreaThreshold: number;
    featureFilterMethod: 'bbox_only' | 'polygon_only' | 'hybrid';
    hybridFilterConfig?: HybridFilterConfig;
  };
  
  simplify2: {
    quantize: number;
    simplify: number;
    tolerance: number;
    enablePerFeatureSimplification: boolean;
  };
  
  vectorTiles: {
    maxZoom: number;
    tileCountThresholdForZoomStop: number;
  };
}
```

### UI Configuration Steps

1. **Basic Info**: Name and description input
2. **Data Source**: Natural Earth, OpenStreetMap selection
3. **License Agreement**: Data usage terms acceptance
4. **Processing Options**: Batch configuration parameters
5. **Country Selection**: Geographic region filtering

## API Reference

### ShapeAPI Interface

```typescript
interface ShapeAPI {
  // Entity operations
  createShape(data: CreateShapeData): Promise<ShapeEntity>;
  updateShape(nodeId: NodeId, data: UpdateShapeData): Promise<void>;
  deleteShape(nodeId: NodeId): Promise<void>;
  
  // Batch operations
  startBatchProcessing(nodeId: NodeId, config: BatchConfig): Promise<void>;
  pauseBatchProcessing(nodeId: NodeId): Promise<void>;
  resumeBatchProcessing(nodeId: NodeId): Promise<void>;
  
  // Error handling
  getErrorSummary(nodeId: NodeId): Promise<ErrorSummary>;
  acknowledgeErrors(nodeId: NodeId, errorIds: string[]): Promise<void>;
  
  // Recovery operations  
  getRecoveryOptions(nodeId: NodeId): Promise<RecoveryOption[]>;
  executeRecovery(nodeId: NodeId, strategy: RecoveryStrategy): Promise<void>;
}
```

### Worker API Integration

```typescript
// Main worker API exposure
export const ShapeWorkerAPI = {
  async createShapeEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity> {
    const handler = new ShapeEntityHandler();
    return handler.createEntity(nodeId, data);
  },
  
  async startBatchSession(nodeId: NodeId, config: BatchConfig): Promise<string> {
    const manager = new BatchSessionManager();
    return manager.startSession(nodeId, config);  
  },
  
  async getErrorState(nodeId: NodeId): Promise<ErrorState> {
    const errorManager = new ErrorStateManager();
    return errorManager.getSessionState(nodeId);
  }
};
```

## Testing

The plugin includes comprehensive test coverage:

### Migration Tests
- **ErrorHandlingMigration.test.ts** - 15 tests covering 3-tier error system
- **BatchSessionMigration.test.ts** - Workflow state persistence
- **ShapeEntityHandlerMigration.test.ts** - Database operations
- **DataSourceManagerMigration.test.ts** - External data integration

### Integration Tests  
- **PluginIntegration.test.ts** - End-to-end plugin lifecycle
- **full-batch-workflow.test.ts** - Complete processing pipeline

### Unit Tests
- Service layer components with mocked dependencies
- UI component rendering and interaction
- Error handling edge cases

### Running Tests

```bash
# Run all shape plugin tests
pnpm --filter @hierarchidb/node-type-shape-plugin test

# Run specific test file
pnpm --filter @hierarchidb/node-type-shape-plugin test ErrorHandlingMigration

# Run tests in watch mode
pnpm --filter @hierarchidb/node-type-shape-plugin test --watch
```

## Development

### Building

```bash
# Build plugin
pnpm --filter @hierarchidb/node-type-shape-plugin build

# Build with dependencies
turbo run build --filter @hierarchidb/node-type-shape-plugin

# Development mode with hot reload
pnpm --filter @hierarchidb/node-type-shape-plugin dev
```

### Project Structure

```
packages/node-type-plugin/shape/
├── src/
│   ├── shared/          # Common types and utilities
│   ├── ui/              # React components and hooks
│   ├── worker/          # Background processing logic
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   ├── components/      # Legacy UI components  
│   └── __tests__/       # Test files
├── dist/                # Build output
├── package.json         # Package configuration
├── tsup.config.ts       # Build configuration
├── vitest.config.ts     # Test configuration
└── README.md            # This file
```

### Key Dependencies

- **@hierarchidb/core** - Core HierarchiDB types and patterns
- **@hierarchidb/api** - Worker API contracts
- **@turf/turf** - Geographic computation library
- **dexie** - IndexedDB wrapper for database operations
- **@mapbox/vector-tile** - Vector tile processing
- **topojson-client/server** - TopoJSON format support

## Migration from ERIA-Cartograph

This plugin was migrated from the ERIA-Cartograph project with the following key changes:

1. **Architecture Alignment**: Adapted to HierarchiDB's 3-layer plugin architecture
2. **Error System Redesign**: Implemented 3-tier error management replacing complex object storage
3. **Database Integration**: Migrated from standalone IndexedDB to HierarchiDB's CoreDB/EphemeralDB pattern
4. **API Standardization**: Conformed to HierarchiDB's Comlink RPC patterns
5. **Type Safety**: Enhanced TypeScript usage with branded types (NodeId, TreeId, EntityId)

### Breaking Changes

- Database schema changes require data migration
- API method signatures updated for consistency
- Error handling now uses structured 3-tier system
- UI components reorganized into shared/ui/worker layers

## License

This plugin inherits the license from the HierarchiDB project. Geographic data sources have their own licensing requirements which are handled through the license agreement step in the UI.