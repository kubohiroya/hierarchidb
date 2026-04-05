# @hierarchidb/shape-plugin

Last updated: 2026-04-05

A geographic shape data management plugin for HierarchiDB. Imports country and administrative-area shape data from online data sources (Natural Earth, geoBoundaries, GADM), generates vector tiles, and visualizes results in a Map preview. Supports batch processing via BuildSession, stage-based pipeline execution, and pause/resume capabilities.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `shape` |
| extends | `folder` |
| category | `geographic` (menuGroup: `geo`, createOrder: `800`) |
| priority | `800` |

shape-plugin inherits from folder-plugin and provides geographic shape data acquisition, transformation, tile generation, and preview. basemap-plugin is an optional dependency used for base map layers in the Map preview.

## UI Layer

### Dialog Steps

shape-plugin provides a 6-step wizard via `PluginStepRegistry` (step 1 is provided by a shared plugin):

| Step | ID | Component | Description |
| --- | --- | --- | --- |
| 1 | `basicInfo` | *(ui-plugin-basic-info)* | Basic info (name / description) — provided by `@hierarchidb/ui-plugin-basic-info` |
| 2 | `data-source` | `ShapeDataSourceStep` | Select data source (Natural Earth / geoBoundaries / GADM) |
| 3 | `country-selection` | `ShapeCountrySelectionStep` | Select countries and administrative levels |
| 4 | `processing-configuration` | `ShapeBuildConfigStep` | Configure build settings (simplification parameters, zoom bands, etc.) |
| 5 | `build` | `ShapeBuildStep` | Execute build and display progress |
| 6 | `preview` | `ShapePreviewStep` | Map preview of generated vector tiles |

### Components

| Component | Description |
| --- | --- |
| `ShapeDataSourceStep` | Data source selection UI (includes license agreement) |
| `ShapeCountrySelectionStep` | Country and ADM level checkbox selection |
| `ShapeBuildConfigStep` | Build configuration (simplification tolerance, zoom bands, filters, etc.) |
| `ShapeBuildStep` | Build progress display (per-stage progress, pause/resume/cancel) |
| `ShapePreviewStep` | MapLibre-based vector tile preview |
| `ErrorDisplay` | Error display component |

### Jotai Atoms (SSOT State Tree)

Build session state uses the jotai atom tree as the single source of truth (SSOT):

| Atom | Description |
| --- | --- |
| `buildSessionStateAtoms` | Session phase, stage progress, task state |
| `shapeBuildProgressAtoms` | Aggregated build progress for display |
| `shapePreviewAtoms` | Preview search, selection, and hover state |
| `buildSessionWorkerEventAdapter` | Worker→UI event to atom update adapter |

### Icon

```typescript
// Entry point: @hierarchidb/shape-plugin/icon
import { ShapePluginIcon } from '@hierarchidb/shape-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `Hexagon` |
| Emoji | ♦️ |
| Color | `#a3b030` |

## Worker Layer

### ShapeEntityService (EntityHandler)

`ShapeEntityService` performs ShapeEntity CRUD through CoreDB `TreeNode` payload/draftData:

- `getEntity(nodeId)` — Reconstruct ShapeEntity from TreeNode (draftData takes priority)
- `updateEntity(nodeId, updates)` — Merge-update payload/draftData
- `updateProcessingStatus(nodeId, status)` — Update processing status

### ShapeWorkerPlugin

Registers the plugin in the Worker environment. Provides build API, entity handler, validation, and lifecycle hooks:

```typescript
// Worker plugin exports
export { registerShapeWorkerStores } from './factory/registerShapeWorkerStores.js';
export { shapeBuildAPI } from './api.js';
export { ShapeWorkerPlugin } from './ShapeWorkerPlugin.js';
```

### Lifecycle

| Event | Action |
| --- | --- |
| `afterCreate` | Resource initialization (reserved) |
| `beforeDelete` | `shapeBuildAPI.cleanupProcessingData(nodeId)` cleans up processing data |
| `afterUpdate` | Reprocessing trigger on config change (reserved) |

### Worker preload

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerShapeWorkerStores', 'loadShapeEntitiesDbModule'],
}
```

## Database Schema

shape-plugin uses a dedicated Dexie-based database.

### Main Table (featureMetadata)

```typescript
// plugin-manifest.ts — database definition
database: {
  dbName: 'shape',
  tableName: 'featureMetadata',
  version: 7,
  schema: {
    fields: [
      { name: 'nodeId', indexed: true },
      { name: 'adminLevel', indexed: true },
      { name: 'featureId', indexed: true },
      { name: 'createdAt', indexed: true },
      { name: 'updatedAt', indexed: true },
    ],
  },
}
```

### Additional Tables (ShapeWorkerPlugin)

| Table | Schema | Description |
| --- | --- | --- |
| `shapeBuildSessions` | `&nodeId` | Build session state |
| `shapeBuildTasks` | `&taskId, nodeId, stage, progress` | Build tasks |
| `shapeFeatures` | `&featureId, nodeId, countryCode, adminLevel, geometry` | Feature data |
| `shapeVectorTiles` | `&tileId, nodeId, z, x, y, data, size` | Vector tiles |
| `shapeCache` | `&cacheKey, nodeId, cacheType, data, size, createdAt` | Cache |

### VectorTileEntity

```typescript
interface VectorTileEntity {
  tileId: string;       // "${nodeId}-${z}-${x}-${y}"
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  layers: LayerInfo[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: 'gzip' | 'br';
  version: number;
}
```

## Plugin Dependencies

```typescript
// PluginManifest
dependencies: ['folder'],
optionalDependencies: ['basemap'],
```

| Plugin | Relationship |
| --- | --- |
| `folder` | Required — inherits base node type |
| `basemap` | Optional — base map layer for Map preview |

`spreadsheet-plugin` is declared as a peerDependency and integrates with the Tabular Preview feature.

## Configuration

### Capabilities

```typescript
capabilities: {
  canHaveChildren: false,
  canBeRoot: false,
  canBeDeleted: true,
  canBeRenamed: true,
  canBeMoved: true,
  canBeCopied: false,
  supportsBuildProcessing: true,  // batch processing support
}
```

### Schema

```typescript
schema: {
  inherits: 'folder',
  fields: [
    { name: 'selectedArrayByCountries', type: 'array', required: true },
    { name: 'licenseAgreement', type: 'boolean', required: true },
  ],
}
```

### Data Sources

| Data Source | Display Name | License | Max ADM Level | Country Code Format |
| --- | --- | --- | --- | --- |
| `naturalearth` | Natural Earth | Public Domain | 2 | ISO2 |
| `geoboundaries` | geoBoundaries | CC BY 4.0 | 5 | ISO3 |
| `geoboundaries-topojson` | geoBoundaries:TopoJSON | CC BY 4.0 | 5 | ISO3 |
| `gadm` | GADM | Academic Use | 4 | ISO3 |

The internal canonical code system uses ISO2. `sourceKey` and cache keys are unified on ISO2. For data sources that require ISO3, the DataSourceStrategy handles ISO2→ISO3 conversion.

### i18n

| Field | Value |
| --- | --- |
| namespace | `shape-plugin` |
| Locales | `en`, `ja` |

## Batch Processing

shape-plugin declares `supportsBuildProcessing: true` and executes batch processing through a stage-based pipeline.

### Pipeline Stages

```text
source → geometry → tileEmit → profile → metadata → cleanup
```

| Stage | Description |
| --- | --- |
| `source` | Fetch GeoJSON per country×ADM level from data source, convert to flatgeobuf, and persist |
| `geometry` | Apply Douglas–Peucker simplification per zoom band, generate simplified FGB |
| `tileEmit` | Generate vector tiles (MVT) with geojson-vt and save to VectorTileStore |
| `profile` | Stage execution profiling |
| `metadata` | Feature metadata generation and update |
| `cleanup` | Intermediate data cleanup |

### BuildSession Lifecycle

Build sessions follow these phases:

| Phase | Meaning |
| --- | --- |
| `idle` | Session not started or fully completed |
| `starting` | Build start in progress |
| `running` | Stage execution in progress |
| `pausing` | Pause command sent, awaiting Worker response |
| `paused` | Paused (resumable) |
| `resuming` | Resume command sent, awaiting Worker response |
| `finalizing` | Post-processing after all stages complete |
| `completed` | Successfully completed (terminal state) |
| `failed` | Error termination (terminal state) |

### Task Statuses

| Status | Meaning |
| --- | --- |
| `queued` | Waiting for processing |
| `running` | Processing in progress |
| `completed` | Processing succeeded |
| `failed` | Processing failed |
| `skipped` | Executed but no artifact produced |
| `recycled` | Skipped due to valid cache |

### Worker→UI Events

Build session progress is communicated to the UI through canonical events defined in `@hierarchidb/build-api`:

- `SessionStatusUpdatedEvent` — Session phase change
- `StageSnapshotUpdatedEvent` — Stage snapshot update
- `TaskProgressUpdatedEvent` — Task progress update
- `HeartbeatEvent` — Heartbeat
- `CriticalErrorEvent` — Critical error

### Cache and Reconciliation

`shapeStageReconcile` verifies cache consistency across stages. Tasks with valid existing cache are marked as `recycled` and skipped. `CacheValidator` validates cache entry integrity.

## Map Preview

shape-plugin provides a Map preview of vector tiles using MapLibre GL JS.

### Preview Features

- Display vector tiles on a map after build completion (or during processing)
- Feature search, selection, and hover highlighting
- Feature filtering by ADM level
- Overlay with base map layers (basemap-plugin integration)
- Preview state persistence (center coordinates and zoom via `ShapePreviewMapView`)

### Preview Component Structure

```text
ShapePreviewStep
├── ShapePreviewStepView        # Main preview view
├── useShapePreviewStep          # Preview step logic
├── useShapePreviewStepSceneView # Scene view management
├── useVectorTilePreviewTable    # Vector tile data table
└── internal/
    ├── useShapePreviewFeatureSection  # Feature section display
    └── useShapePreviewStepUtils       # Utility hooks
```

### Tabular Preview

When the `SHAPE_TABULAR=1` flag is enabled, a "Data Table" tab is added to the Build Progress view, allowing inspection of simplified property tables. Supports multi-condition filtering (AND), column visibility toggling, and `eq` condition indexing (lazy-created on first use).

## Usage Examples

### Referencing the PluginManifest

```typescript
import { ShapePluginManifest } from '@hierarchidb/shape-plugin/common';

console.log(ShapePluginManifest.nodeType); // 'shape'
console.log(ShapePluginManifest.capabilities.supportsBuildProcessing); // true
```

### Referencing Data Source Configuration

```typescript
import { SHAPE_DATA_SOURCES, SHAPE_DATA_SOURCE_BY_NAME } from '@hierarchidb/shape-plugin/common';

// List all available data sources
for (const ds of SHAPE_DATA_SOURCES) {
  console.log(`${ds.displayName}: ${ds.license} (max ADM ${ds.maxAdminLevel})`);
}

// Look up a specific data source
const gb = SHAPE_DATA_SOURCE_BY_NAME['geoboundaries'];
console.log(gb.displayName); // 'geoBoundaries'
```

### Using ShapePluginIcon

```tsx
import { ShapePluginIcon } from '@hierarchidb/shape-plugin/icon';

<ShapePluginIcon sx={{ color: '#a3b030' }} />
```

## Directory Structure

```text
src/
├── plugin-manifest.ts              # PluginManifest definition
├── common/
│   ├── index.ts                    # Common public API entry point
│   ├── config/
│   │   └── previewFlags.ts         # Feature flags (SHAPE_TABULAR etc.)
│   ├── types/
│   │   ├── BuildTaskResult.ts      # ShapeBuildConfig, ShapeRuntimeBuildConfig
│   │   ├── constants.ts            # Data source definitions, default configs
│   │   ├── create-update.ts        # Create/update data types
│   │   ├── data-source.ts          # DataSourceName, CountryMetadata, SourceTaskPayload
│   │   ├── session-events.ts       # Re-exports from @hierarchidb/build-api
│   │   ├── ShapeEntity.ts          # ShapeEntity, ShapeEntityPayload
│   │   ├── ShapeFeaturePayload.ts  # Feature payload type
│   │   ├── validation.ts           # Validation utilities
│   │   └── VectorTileEntity.ts     # VectorTileEntity type
│   └── utils/
│       ├── estimates.ts            # Time estimation utilities
│       ├── taskMessages.ts         # Task message formatting
│       └── taskTitles.ts           # Task title formatting
├── icon/
│   └── index.ts                    # ShapePluginIcon (re-export of MUI Hexagon)
├── services/
│   ├── index.ts                    # Service exports
│   ├── CacheValidator.ts           # Cache entry validation
│   ├── stageProfile.ts             # Stage profiling
│   ├── build/                      # Build API client, session mappers, stage aliases
│   ├── datasources/                # DataSourceStrategy (NaturalEarth, GeoBoundaries, GADM)
│   ├── metadata/                   # Metadata loader and sources
│   ├── tabular/                    # ShapeTabularMetadataManager
│   ├── utils/                      # Chunk store, fetch, ISO3166, pipeline utilities
│   └── vt/                         # Vector tile pipeline (runShapePipeline, stages)
├── ui/
│   ├── index.ts                    # UI entry point (step registration + resource registration)
│   ├── atoms/                      # Jotai atoms (build session state, progress, preview)
│   ├── components/
│   │   ├── build-config/           # Build configuration step
│   │   ├── build-progress/         # Build progress step (ShapeBuildStep)
│   │   ├── country-selection/      # Country/ADM selection step
│   │   ├── data-source/            # Data source selection step
│   │   ├── preview/                # Map preview step (MapLibre integration)
│   │   ├── processing/             # Processing components
│   │   └── steps-provider.tsx      # PluginStepRegistry registration
│   ├── hooks/                      # UI hooks (country metadata, build cache, config sections)
│   ├── locales/                    # i18n resources (en.json, ja.json)
│   ├── utils/                      # UI utilities (build warnings, sanitize, cache clear)
│   └── workers/                    # Country availability web worker
└── worker/
    ├── index.ts                    # Worker entry point
    ├── ShapeWorkerPlugin.ts        # Worker plugin definition
    ├── api.ts                      # Build API export
    ├── api/                        # Build API implementation modules
    ├── factory/                    # Worker store registration
    ├── handlers/                   # ShapeEntityHandler / ShapeEntityService
    ├── createShapeFeatureStoreDexie.ts
    ├── shapeVectorTileStore.dexie.ts
    └── taskOrdering.ts             # Task execution ordering
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/shape-plugin/common` | Type definitions, PluginManifest, data source constants, validation |
| `@hierarchidb/shape-plugin/ui` | UI components (step registration, resource registration) |
| `@hierarchidb/shape-plugin/icon` | ShapePluginIcon |
| `@hierarchidb/shape-plugin/worker` | Worker plugin (store registration, build API, ShapeWorkerPlugin) |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — Plugin base (PluginManifest, PluginStepRegistry)
- [`@hierarchidb/core-types`](../packages/core-types/) — Shared type definitions (NodeId, NodeType, ISO2, etc.)
- [`@hierarchidb/folder-plugin`](../plugins/folder-plugin/) — Base node type (inherited)
- [`@hierarchidb/shape-store`](../packages/shape-store/) — Shape data store (Dexie)
- [`@hierarchidb/shape-api`](../packages/shape-api/) — Shape API type definitions
- [`@hierarchidb/vectortile-store`](../packages/vectortile-store/) — Vector tile store
- [`@hierarchidb/vectortile-orchestrator`](../packages/vectortile-orchestrator/) — Vector tile orchestrator
- [`@hierarchidb/vt-orchestrator`](../packages/vt-orchestrator/) — VT orchestrator
- [`@hierarchidb/build-api`](../packages/build-api/) — Build API type definitions and session events
- [`@hierarchidb/build-runtime-services`](../packages/build-runtime-services/) — Build runtime services
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — Worker runtime (CoreDB, FeatureStore, VectorTileStore)
- [`@hierarchidb/gis-sdk`](../packages/gis-sdk/) — GIS SDK (geometry config types, simplification parameters)
- [`@hierarchidb/chunk-store`](../packages/chunk-store/) — Chunk store (download data persistence)
- [`@hierarchidb/download`](../packages/download/) — Download service
- [`@hierarchidb/auth`](../packages/auth/) — Authentication (fetchWithAuth, 401 recovery)
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode type definitions
- [`@hierarchidb/tabular-store`](../packages/tabular-store/) — Tabular data store
- [`@hierarchidb/gen-iso3166-2`](../packages/tools/gen-iso3166-2/) — ISO 3166-2 code generation
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — Plugin UI SDK
- [`@hierarchidb/plugin-service-api`](../packages/plugin-service-api/) — Plugin service API
- [`@hierarchidb/ui-map`](../packages/ui/map/) — Map UI components
- [`@hierarchidb/ui-build-progress`](../packages/ui/build-progress/) — Build progress UI
- [`@hierarchidb/ui-build-sessions`](../packages/ui/build-sessions/) — Build session management UI
- [`@hierarchidb/ui-country-select`](../packages/ui/country-select/) — Country selection UI
- [`@hierarchidb/ui-datasource`](../packages/ui/datasource/) — Data source selection UI
- [`@hierarchidb/spreadsheet-plugin`](../plugins/spreadsheet-plugin/) — Tabular Preview integration

### Related Plugins

- [`basemap-plugin`](../plugins/basemap-plugin/) — Base map for Map preview (optional dependency)
- [`location-plugin`](../plugins/location-plugin/) — Location entities (Shape data integration)
- [`route-plugin`](../plugins/route-plugin/) — Route generation (Shape data integration)

### Design Documents

- [`docs/build-session-spec.md`](../docs/build-session-spec.md) — Build session lifecycle specification
- [`docs/vt-shape-pipeline-design.md`](../docs/vt-shape-pipeline-design.md) — Shape pipeline design
- [`docs/build-session-worker-ui-event-spec.md`](../docs/build-session-worker-ui-event-spec.md) — Worker→UI event specification

## License

MIT
