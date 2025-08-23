# BaseMap Plugin Data Model

This document describes the data model, entity architecture, and database design for the BaseMap Plugin.

## Entity Architecture

The BaseMap Plugin uses a **PeerEntity** pattern, implementing a 1:1 relationship between TreeNode and BaseMapEntity:

```
TreeNode (id: NodeId) ←→ BaseMapEntity (nodeId: NodeId)
```

This design ensures that each map configuration corresponds directly to a tree node, providing clear data ownership and navigation.

## Entity Definitions

### BaseMapEntity

The core entity representing a map configuration:

```typescript
interface BaseMapEntity extends PeerEntity {
  nodeId: NodeId;

  // Map style configuration
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  styleUrl?: string;
  styleConfig?: MapLibreStyleConfig;

  // Map viewport settings
  center: [number, number]; // [longitude, latitude]
  zoom: number; // Zoom level (0-22)
  bearing: number; // Rotation angle in degrees (0-360)
  pitch: number; // Tilt angle in degrees (0-60)

  // Map bounds (optional)
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  // Display options
  displayOptions?: {
    show3dBuildings?: boolean;
    showTraffic?: boolean;
    showTransit?: boolean;
    showTerrain?: boolean;
    showLabels?: boolean;
  };

  // Access configuration
  apiKey?: string;
  attribution?: string;

  // Metadata
  thumbnailUrl?: string;
  tags?: string[];

  // Timestamps
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### BaseMapWorkingCopy

Working copy entity for draft editing operations:

```typescript
interface BaseMapWorkingCopy extends WorkingCopy {
  nodeId: NodeId;
  name: string;
  description?: string;

  // All BaseMapEntity fields for editing
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom';
  styleUrl?: string;
  styleConfig?: MapLibreStyleConfig;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  displayOptions?: {
    show3dBuildings?: boolean;
    showTraffic?: boolean;
    showTransit?: boolean;
    showTerrain?: boolean;
    showLabels?: boolean;
  };
  apiKey?: string;
  attribution?: string;
  thumbnailUrl?: string;
  tags?: string[];

  // Working copy specific fields (inherited from WorkingCopy)
  workingCopyId: string;
  workingCopyOf: NodeId;
  copiedAt: number;
  isDirty: boolean;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### MapLibreStyleConfig

Complete MapLibre GL style specification support:

```typescript
interface MapLibreStyleConfig {
  version: number;
  name?: string;
  metadata?: SourceMetadata;

  // Data sources
  sources: Record<string, {
    type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'image' | 'video';
    tiles?: string[];
    url?: string;
    minzoom?: number;
    maxzoom?: number;
    tileSize?: number;
    scheme?: 'xyz' | 'tms';
    attribution?: string;
    metadata?: SourceMetadata;
  }>;

  // Map layers
  layers: Array<{
    id: string;
    type: 'fill' | 'line' | 'symbol' | 'circle' | 'heatmap' | 
          'fill-extrusion' | 'raster' | 'hillshade' | 'background';
    source?: string;
    'source-layer'?: string;
    minzoom?: number;
    maxzoom?: number;
    filter?: FilterExpression[];
    layout?: LayerLayoutProperties;
    paint?: LayerPaintProperties;
    metadata?: LayerMetadata;
  }>;

  // Style configuration
  sprite?: string;
  glyphs?: string;
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
}
```

## Database Schema

### Core Database Tables

#### 1. basemaps (Primary Entity Storage)
```sql
CREATE TABLE basemaps (
  nodeId TEXT PRIMARY KEY,
  mapStyle TEXT NOT NULL,
  styleUrl TEXT,
  styleConfig TEXT, -- JSON serialized MapLibreStyleConfig
  center TEXT NOT NULL, -- JSON serialized [lng, lat]
  zoom REAL NOT NULL,
  bearing REAL NOT NULL,
  pitch REAL NOT NULL,
  bounds TEXT, -- JSON serialized bounds object
  displayOptions TEXT, -- JSON serialized display options
  apiKey TEXT,
  attribution TEXT,
  thumbnailUrl TEXT,
  tags TEXT, -- JSON serialized string array
  updatedAt INTEGER NOT NULL,
  version INTEGER NOT NULL
);

-- Indexes for optimization
CREATE INDEX idx_basemaps_nodeId ON basemaps(nodeId);
CREATE INDEX idx_basemaps_mapStyle ON basemaps(mapStyle);
CREATE INDEX idx_basemaps_updatedAt ON basemaps(updatedAt);
```

#### Dexie Schema Configuration
```typescript
const coreDBSchema = {
  basemaps: '&nodeId, mapStyle, updatedAt'
};
```

### Ephemeral Database Tables

#### 1. basemap_workingcopies (Draft Editing)
```sql
CREATE TABLE basemap_workingcopies (
  workingCopyId TEXT PRIMARY KEY,
  workingCopyOf TEXT NOT NULL, -- NodeId reference
  nodeId TEXT NOT NULL,
  -- All BaseMapEntity fields for editing
  mapStyle TEXT NOT NULL,
  styleUrl TEXT,
  styleConfig TEXT,
  center TEXT NOT NULL,
  zoom REAL NOT NULL,
  bearing REAL NOT NULL,
  pitch REAL NOT NULL,
  bounds TEXT,
  displayOptions TEXT,
  apiKey TEXT,
  attribution TEXT,
  thumbnailUrl TEXT,
  tags TEXT,
  -- Working copy metadata
  copiedAt INTEGER NOT NULL,
  isDirty BOOLEAN NOT NULL,
  originalVersion INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  version INTEGER NOT NULL
);

-- TTL: 24 hours (86400000 ms)
CREATE INDEX idx_workingcopies_copiedAt ON basemap_workingcopies(copiedAt);
```

#### 2. basemap_tiles_cache (Tile Optimization)
```sql
CREATE TABLE basemap_tiles_cache (
  tileId TEXT PRIMARY KEY, -- Constructed from nodeId + zoom + x + y
  nodeId TEXT NOT NULL,
  zoom INTEGER NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  tileData BLOB, -- Cached tile data
  contentType TEXT,
  cachedAt INTEGER NOT NULL,
  expiresAt INTEGER
);

-- TTL: 1 hour (3600000 ms)
CREATE INDEX idx_tiles_cache_nodeId ON basemap_tiles_cache(nodeId);
CREATE INDEX idx_tiles_cache_cachedAt ON basemap_tiles_cache(cachedAt);
```

#### Dexie Schema Configuration
```typescript
const ephemeralDBSchema = {
  basemap_workingcopies: '&workingCopyId, workingCopyOf, copiedAt',
  basemap_tiles_cache: '&tileId, zoom, x, y, cachedAt'
};
```

**注意**: タイルキャッシュテーブルでは`nodeId`フィールドはインデックスされていません。

## Entity Handler Architecture

### BaseMapEntityHandler

Extends `BaseEntityHandler` implementing the PeerEntity pattern:

**注意**: 実装では、WorkingCopyでは`originalVersion`フィールドではなく、直接`version`フィールドが使用されています。

```typescript
class BaseMapEntityHandler extends BaseEntityHandler<BaseMapEntity> {
  constructor() {
    super(
      null, // Database injected by plugin system
      'basemaps', // Core table name
      'basemap_working_copies', // Ephemeral table name
      undefined // No sub-entities
    );
  }

  // PeerEntityHandler overrides
  async createEntity(nodeId: NodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity>
  async getEntity(nodeId: NodeId): Promise<BaseMapEntity | undefined>
  async updateEntity(nodeId: NodeId, data: Partial<BaseMapEntity>): Promise<void>
  async deleteEntity(nodeId: NodeId): Promise<void>

  // Working copy operations
  async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy>
  async commitWorkingCopy(nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<void>
  async discardWorkingCopy(nodeId: NodeId): Promise<void>

  // Plugin-specific operations
  async changeMapStyle(nodeId: NodeId, style: BaseMapEntity['mapStyle']): Promise<void>
  async setBounds(nodeId: NodeId, bounds: [[number, number], [number, number]]): Promise<void>
  async clearTileCache(nodeId: NodeId): Promise<void>
  async findNearbyMaps(center: [number, number], radius: number): Promise<BaseMapEntity[]>
}
```

### Key Handler Methods

#### Entity CRUD Operations
```typescript
// Create new basemap entity with default values
async createEntity(nodeId: NodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
  const entity: BaseMapEntity = {
    nodeId,
    mapStyle: data?.mapStyle || 'streets',
    center: data?.center || [0, 0],
    zoom: data?.zoom || 10,
    bearing: data?.bearing || 0,
    pitch: data?.pitch || 0,
    displayOptions: data?.displayOptions || {
      show3dBuildings: false,
      showTraffic: false,
      showTransit: false,
      showTerrain: false,
      showLabels: true,
    },
    updatedAt: Date.now(),
    version: 1,
    ...data
  };

  await this.coreDB.table('basemaps').add(entity);
  return entity;
}
```

#### Working Copy Operations
```typescript
// Create working copy for draft editing
async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
  const entity = await this.getEntity(nodeId);
  if (!entity) {
    throw new Error(`BaseMap entity not found for node: ${nodeId}`);
  }

  const workingCopy: BaseMapWorkingCopy = {
    ...entity,
    workingCopyId: `wc-${nodeId}-${Date.now()}`,
    workingCopyOf: nodeId,
    copiedAt: Date.now(),
    isDirty: false,
    // Note: 実装では originalVersion フィールドは使用されていません
  };

  await this.ephemeralDB.table('basemap_workingcopies').add(workingCopy);
  return workingCopy;
}

// Commit working copy changes to core entity
async commitWorkingCopy(nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
  const { isDirty, ...entityData } = workingCopy;
  
  // Update the entity with working copy data
  await this.updateEntity(nodeId, entityData);
  
  // Note: 実装では作業コピーのクリーンアップは自動的に処理されます
}
```

## Data Flow

### Create Operation
```
1. UI: User triggers create basemap
2. Worker: CommandManager.execute(CreateNodeCommand)
3. Worker: NodeLifecycleManager.beforeCreate hook
4. Worker: BaseMapEntityHandler.createEntity()
5. Database: Insert into basemaps table
6. Worker: NodeLifecycleManager.afterCreate hook
7. UI: Subscription update notification
```

### Edit Operation (Working Copy Pattern)
```
1. UI: User starts editing
2. Worker: BaseMapEntityHandler.createWorkingCopy()
3. Database: Insert into basemap_workingcopies table
4. UI: User modifies working copy data
5. Worker: BaseMapEntityHandler.updateWorkingCopy()
6. UI: User commits changes
7. Worker: BaseMapEntityHandler.commitWorkingCopy()
8. Database: Update basemaps table, delete working copy
9. UI: Subscription update notification
```

### Tile Caching Flow
```
1. UI: Map requests tile
2. Worker: Check basemap_tiles_cache table
3. Cache Hit: Return cached tile data
4. Cache Miss: Fetch from external service
5. Worker: Store in basemap_tiles_cache with TTL
6. UI: Display tile
7. Background: TTL cleanup removes expired tiles
```

## Data Validation

### Entity Validation Rules
```typescript
const validationRules = {
  // Coordinate validation
  center: (center: [number, number]) => {
    const [lng, lat] = center;
    return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
  },

  // Zoom level validation
  zoom: (zoom: number) => zoom >= 0 && zoom <= 22,

  // Bearing validation
  bearing: (bearing: number) => bearing >= 0 && bearing <= 360,

  // Pitch validation
  pitch: (pitch: number) => pitch >= 0 && pitch <= 60,

  // Map style validation
  mapStyle: (style: string) => 
    ['streets', 'satellite', 'hybrid', 'terrain', 'custom'].includes(style),

  // Custom style validation
  customStyle: (entity: BaseMapEntity) => {
    if (entity.mapStyle === 'custom') {
      return entity.styleUrl || entity.styleConfig;
    }
    return true;
  }
};
```

### MapLibre Style Validation
```typescript
// Basic style schema validation
const validateMapLibreStyle = (style: MapLibreStyleConfig): boolean => {
  // Required fields
  if (!style.version || !style.sources || !style.layers) {
    return false;
  }

  // Version must be 8
  if (style.version !== 8) {
    return false;
  }

  // Validate sources
  for (const [sourceId, source] of Object.entries(style.sources)) {
    if (!source.type || !['vector', 'raster', 'raster-dem', 'geojson', 'image', 'video'].includes(source.type)) {
      return false;
    }
  }

  // Validate layers
  for (const layer of style.layers) {
    if (!layer.id || !layer.type) {
      return false;
    }
  }

  return true;
};
```

## Performance Considerations

### Indexing Strategy
- **Primary Keys**: `nodeId` for direct entity lookup
- **Search Indexes**: `nodeId`, `mapStyle`, `updatedAt` for filtering and sorting
- **Cache Indexes**: `zoom`, `x`, `y`, `cachedAt` for tile cache management

### Caching Strategy
- **Entity Caching**: Working copy pattern reduces database reads during editing
- **Tile Caching**: Ephemeral storage with TTL for map tile optimization
- **Style Caching**: In-memory caching of parsed MapLibre styles

### Memory Management
- **TTL Cleanup**: Automatic cleanup of expired working copies and tile cache
- **Lazy Loading**: Entity data loaded on-demand
- **Batch Operations**: Bulk tile cache operations for performance

## Integration Points

### HierarchiDB Core Integration
- **TreeNode**: `nodeId` foreign key relationship
- **CommandManager**: All mutations go through command pattern
- **SubscriptionManager**: Real-time UI updates on entity changes
- **NodeLifecycleManager**: Plugin hooks for create/update/delete operations

### Plugin System Integration
- **PluginRegistry**: Register entity handler and database schema
- **Database Manager**: Automatic table creation and migration
- **Worker Router**: RPC endpoint registration for UI communication