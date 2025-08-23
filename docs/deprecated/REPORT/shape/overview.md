# Shape Plugin Overview

The Shape Plugin provides comprehensive geospatial data management capabilities for HierarchiDB, enabling users to work with geographic boundaries and administrative regions through an integrated download, processing, and visualization pipeline.

## Architecture Overview

The Shape Plugin follows HierarchiDB's 4-layer architecture with strict UI-Worker separation:

```
UI Layer (React Components) ←→ Comlink RPC ←→ Worker Layer (Processing) ←→ IndexedDB (Storage)
```

### Key Components

- **UI Layer**: React components for user interaction, dialogs, and visualization
- **Worker Layer**: Background processing with Worker pools for CPU-intensive operations
- **Data Layer**: IndexedDB storage with 6-category entity system
- **API Layer**: PluginAPI integration for seamless HierarchiDB integration

## Feature Overview

### 1. Data Source Integration
- **GADM**: Global Administrative Areas with hierarchical boundaries
- **GeoBoundaries**: High-quality administrative boundaries
- **Natural Earth**: Cartographic data for visualization
- **OpenStreetMap**: Community-driven geographic data

### 2. Processing Pipeline
Four-stage Worker pool architecture:
1. **Download**: Fetch and cache geographic data
2. **Simplify1**: Initial geometry simplification with Douglas-Peucker
3. **Simplify2**: TopoJSON-based topology-preserving simplification
4. **VectorTiles**: Generate Mapbox Vector Tiles for efficient rendering

### 3. Data Storage
Comprehensive entity system supporting:
- **Shape Entities**: Main geographic feature data
- **Batch Tasks**: Processing pipeline state management
- **Feature Buffers**: Optimized geometric data storage
- **Vector Tiles**: Cached tile data for visualization

## Documentation Structure

This documentation is organized into focused sections:

### Core Documentation
- **[overview.md](./overview.md)** - This overview document
- **[data-model.md](./data-model.md)** - Database entities, Worker architecture, and processing systems
- **[ui-architecture.md](./ui-architecture.md)** - React components and user interface
- **[implementation-guide.md](./implementation-guide.md)** - Development roadmap and implementation details

### Specialized Documentation
- **[lifecycle.md](./lifecycle.md)** - Task lifecycle and state management
- **[api-reference.md](./api-reference.md)** - Complete API documentation

## Quick Start

### For Developers
1. **Backend Development**: Start with [data-model.md](./data-model.md) - Worker architecture section
2. **Frontend Development**: Start with [ui-architecture.md](./ui-architecture.md)
3. **Data Modeling**: Review [data-model.md](./data-model.md) - Entity definitions section
4. **Implementation**: Follow [implementation-guide.md](./implementation-guide.md)

### For Users
1. **Creating Shapes**: Use the Shape dialog to configure data sources
2. **Processing Data**: Monitor batch processing progress
3. **Visualization**: View processed shapes on the map

## Integration with HierarchiDB

The Shape Plugin seamlessly integrates with HierarchiDB's core systems:

- **Node Type System**: Registers as `'shape'` node type
- **Entity Handlers**: Implements `ShapeEntityHandler` for database operations
- **Working Copy Pattern**: Supports draft editing and commit/rollback
- **Command Pattern**: All mutations go through CommandManager
- **Subscription System**: UI automatically updates on data changes

## Performance Characteristics

- **Worker Pools**: Parallel processing with configurable concurrency
- **Spatial Indexing**: Morton codes for efficient spatial queries
- **Binary Encoding**: Geobuf/Topobuf for optimized data transfer
- **Incremental Processing**: Resume interrupted batch operations
- **Memory Management**: Streaming processing for large datasets

## Next Steps

1. Review the specific architecture documentation for your area of interest
2. Follow the implementation guide for hands-on development
3. Refer to the API reference for detailed interface documentation