# Shape Plugin Implementation Guide

This guide provides a structured approach to implementing the Shape Plugin for HierarchiDB, organized by development phases and technical priorities.

## Implementation Roadmap

### Phase 1: Core Foundation ✅ (Completed)
- ✅ Multi-step dialog UI implementation
- ✅ Data source selection functionality  
- ✅ Country/administrative level selection matrix
- ✅ Basic batch processing framework

### Phase 2: Worker Pool Architecture ✅ (Completed)
- ✅ WorkerPool basic implementation
- ✅ DownloadWorker implementation  
- ✅ SimplifyWorker1/2 implementation
- ✅ VectorTileWorker implementation
- ✅ Type safety improvements (removed all any types)

### Phase 3: Advanced Processing Features
- ⬜ Streaming data processing
- ⬜ Adaptive Worker Pool scaling
- ⬜ Incremental data updates
- ⬜ Differential downloads
- ⬜ Advanced caching strategies

### Phase 4: UI/UX Enhancements
- ⬜ Real-time preview functionality
- ⬜ Detailed processing status display
- ⬜ Error recovery UI
- ⬜ Batch processing scheduling
- ⬜ Preset configuration save/load

### Phase 5: Enterprise Features
- ⬜ Distributed processing support
- ⬜ Cloud storage integration
- ⬜ Background synchronization
- ⬜ Team collaboration features
- ⬜ Audit logging

## Current Implementation Focus (Phase 2)

### File Structure Setup

Create the following service layer structure:

```
packages/plugins/shape/src/services/
├── ShapesPluginAPI.ts           # Main PluginAPI implementation
├── types.ts                     # Service type definitions
├── workers/                     # Worker implementations
│   ├── WorkerPoolManager.ts     # Manages all worker pools
│   ├── WorkerPool.ts            # Generic worker pool
│   ├── DownloadWorker.ts        # Download processing
│   ├── SimplifyWorker1.ts       # Initial simplification
│   ├── SimplifyWorker2.ts       # Advanced simplification
│   └── VectorTileWorker.ts      # Tile generation
├── database/                    # Database management
│   ├── ShapesDatabase.ts        # Main database
│   ├── FeatureDatabase.ts       # Feature storage
│   └── TileDatabase.ts          # Tile storage
└── processors/                  # Processing logic
    ├── GeometryProcessor.ts     # Geometry operations
    ├── SimplificationEngine.ts  # Simplification algorithms
    └── TileGenerator.ts         # Vector tile generation
```

### Implementation Steps

#### Step 1: Complete Worker Pool Implementation

**Priority: HIGH** - Foundation for all processing

```typescript
// WorkerPoolManager.ts - Central coordination
export class WorkerPoolManager {
  private pools: Map<WorkerType, WorkerPool> = new Map();
  
  async initializePools(config: WorkerPoolConfig): Promise<void> {
    // Initialize all worker pools with optimal sizing
    this.pools.set('download', new WorkerPool('download', config.download));
    this.pools.set('simplify1', new WorkerPool('simplify1', config.simplify1));
    this.pools.set('simplify2', new WorkerPool('simplify2', config.simplify2));
    this.pools.set('vectorTile', new WorkerPool('vectorTile', config.vectorTile));
  }
}
```

**Files to implement:**
1. `WorkerPoolManager.ts` - Central worker coordination
2. Complete `WorkerPool.ts` with Comlink integration
3. Error handling and recovery mechanisms

#### Step 2: Implement SimplifyWorker1

**Priority: HIGH** - Core processing functionality

```typescript
// SimplifyWorker1.ts - Douglas-Peucker simplification
export class SimplifyWorker1 {
  async processTask(task: Simplify1Task): Promise<Simplify1Result> {
    // 1. Load raw GeoJSON data
    // 2. Apply Douglas-Peucker algorithm
    // 3. Filter by area/complexity thresholds
    // 4. Store simplified features
    // 5. Generate spatial indices
  }
}
```

**Key algorithms to implement:**
- Douglas-Peucker line simplification
- Polygon area calculation and filtering
- Feature complexity scoring
- Spatial indexing with Morton codes

#### Step 3: Implement SimplifyWorker2

**Priority: HIGH** - Topology-preserving simplification

```typescript
// SimplifyWorker2.ts - TopoJSON-based simplification
export class SimplifyWorker2 {
  async processTask(task: Simplify2Task): Promise<Simplify2Result> {
    // 1. Convert features to TopoJSON
    // 2. Apply topology-preserving simplification
    // 3. Resolve shared boundaries
    // 4. Generate optimized feature buffers
  }
}
```

**Key algorithms to implement:**
- TopoJSON topology construction
- Shared edge detection and preservation
- Topology-aware simplification
- Boundary consistency validation

#### Step 4: Implement VectorTileWorker

**Priority: MEDIUM** - Output generation

```typescript
// VectorTileWorker.ts - MVT generation
export class VectorTileWorker {
  async processTask(task: VectorTileTask): Promise<VectorTileResult> {
    // 1. Query features for tile bounds
    // 2. Clip geometries to tile boundaries
    // 3. Generate Mapbox Vector Tile
    // 4. Apply compression
    // 5. Store with caching metadata
  }
}
```

## Technical Implementation Guidelines

### Database Integration

Follow HierarchiDB's entity patterns:

```typescript
// Entity Handler implementation
export class ShapeEntityHandler extends BaseEntityHandler<ShapesEntity> {
  async createEntity(nodeId: NodeId, data: Partial<ShapesEntity>): Promise<ShapesEntity> {
    const entityId = generateEntityId() as EntityId;
    const entity: ShapesEntity = {
      id: entityId,
      nodeId: nodeId,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    
    await this.table.add(entity);
    return entity;
  }
}
```

### Worker Communication

Use Comlink for type-safe Worker communication:

```typescript
// Worker proxy setup
const workerProxy = Comlink.wrap<SimplifyWorker1API>(
  new Worker('/workers/simplify1.js')
);

// Type-safe method calls
const result = await workerProxy.processSimplification({
  features: geoJsonFeatures,
  tolerance: 0.001,
  preserveTopology: true
});
```

### Error Handling Strategy

Implement comprehensive error recovery:

```typescript
interface TaskError {
  taskId: string;
  errorType: 'network' | 'processing' | 'memory' | 'timeout';
  message: string;
  retryable: boolean;
  suggestedAction?: string;
}

class ErrorRecoveryManager {
  async handleTaskError(error: TaskError): Promise<RecoveryAction> {
    switch (error.errorType) {
      case 'network':
        return { action: 'retry', delay: 5000 };
      case 'memory':
        return { action: 'reduce_batch_size', factor: 0.5 };
      case 'timeout':
        return { action: 'increase_timeout', multiplier: 2 };
      default:
        return { action: 'fail' };
    }
  }
}
```

## Performance Optimization

### Worker Pool Sizing

Configure optimal worker counts based on system capabilities:

```typescript
const defaultPoolSizes = {
  download: Math.min(2, navigator.hardwareConcurrency),      // Network I/O bound
  simplify1: Math.max(2, navigator.hardwareConcurrency - 1), // CPU intensive
  simplify2: Math.max(2, navigator.hardwareConcurrency - 1), // CPU intensive  
  vectorTile: Math.min(2, navigator.hardwareConcurrency)     // Moderate CPU + I/O
};
```

### Memory Management

Implement streaming processing for large datasets:

```typescript
class StreamingProcessor {
  async processLargeDataset(
    features: AsyncIterable<GeoJSONFeature>,
    batchSize: number = 1000
  ): Promise<void> {
    let batch: GeoJSONFeature[] = [];
    
    for await (const feature of features) {
      batch.push(feature);
      
      if (batch.length >= batchSize) {
        await this.processBatch(batch);
        batch = []; // Clear batch to free memory
      }
    }
    
    // Process remaining features
    if (batch.length > 0) {
      await this.processBatch(batch);
    }
  }
}
```

### Spatial Indexing

Use Morton codes for efficient spatial queries:

```typescript
function calculateMortonCode(longitude: number, latitude: number): bigint {
  // Convert lat/lng to normalized coordinates
  const x = Math.floor(((longitude + 180) / 360) * 0xFFFFFFFF);
  const y = Math.floor(((latitude + 90) / 180) * 0xFFFFFFFF);
  
  // Interleave bits to create Morton code
  return interleave(x, y);
}
```

## Testing Strategy

### Unit Tests

Test individual workers in isolation:

```typescript
describe('SimplifyWorker1', () => {
  let worker: SimplifyWorker1;
  
  beforeEach(() => {
    worker = new SimplifyWorker1();
  });
  
  it('should simplify complex polygon', async () => {
    const complexPolygon = createComplexPolygon(1000); // 1000 vertices
    const result = await worker.simplify(complexPolygon, { tolerance: 0.01 });
    
    expect(result.geometry.coordinates[0].length).toBeLessThan(500);
    expect(result.properties.originalComplexity).toBe(1000);
  });
});
```

### Integration Tests

Test complete processing pipelines:

```typescript
describe('Shape Processing Pipeline', () => {
  it('should process complete batch from download to tiles', async () => {
    const batchConfig = createTestBatchConfig();
    const session = await batchManager.startSession(batchConfig);
    
    // Wait for completion
    await session.waitForCompletion();
    
    // Verify all stages completed
    expect(session.downloadProgress).toBe(100);
    expect(session.simplify1Progress).toBe(100);
    expect(session.simplify2Progress).toBe(100);
    expect(session.vectorTileProgress).toBe(100);
  });
});
```

## Development Workflow

### 1. Setup Development Environment

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Run type checking
pnpm typecheck

# Run tests
pnpm test
```

### 2. Implementation Order

1. **Core Services** - Complete WorkerPoolManager and WorkerPool
2. **SimplifyWorker1** - Implement Douglas-Peucker simplification
3. **SimplifyWorker2** - Add TopoJSON processing
4. **VectorTileWorker** - Generate MVT output
5. **Integration** - Connect all components
6. **Testing** - Comprehensive test coverage
7. **Optimization** - Performance tuning

### 3. Code Quality

- Follow TypeScript strict mode
- Use branded types for IDs (`NodeId`, `EntityId`)
- Implement proper error handling
- Add comprehensive documentation
- Maintain test coverage >80%

### 4. Performance Monitoring

Track key metrics during development:

```typescript
interface PerformanceMetrics {
  processingTime: number;     // Total processing time
  memoryUsage: number;        // Peak memory usage
  throughput: number;         // Features processed per second
  errorRate: number;          // Percentage of failed tasks
  cacheHitRate: number;       // Cache effectiveness
}
```

## Next Steps

1. **Immediate (Phase 2)**:
   - Complete SimplifyWorker1 implementation
   - Implement SimplifyWorker2 with TopoJSON
   - Add VectorTileWorker for MVT generation

2. **Short-term (Phase 3)**:
   - Add streaming processing capabilities
   - Implement adaptive worker pool scaling
   - Add incremental update support

3. **Long-term (Phases 4-5)**:
   - Enhanced UI/UX features
   - Enterprise collaboration tools
   - Cloud integration capabilities

This implementation guide provides a clear path forward for completing the Shape Plugin development while maintaining high code quality and performance standards.