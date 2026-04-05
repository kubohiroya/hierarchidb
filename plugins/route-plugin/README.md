# @hierarchidb/route-plugin

Last updated: 2026-04-05

A transportation route management plugin for HierarchiDB. Batch-downloads route data for airways, waterways, roads, railways, and high-speed railways from open data sources such as OpenStreetMap, OpenFlights, searoute-js, Transitland, and Natural Earth, persists them in IndexedDB, and visualizes/analyzes them on a map. Supports 3-stage batch processing (source → geometry → tileEmit) via `RouteBuildSession` (extends `AbstractBuildSession`), lane-policy-based parallel control, and MapLibre-based map preview with transport-mode coloring and line-width adjustment.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `route` |
| extends | `shape` |
| category | `geographic` (menuGroup: `geo`, createOrder: `60`) |
| dependencies | `['shape']` |

route-plugin extends shape-plugin and depends on location-plugin's origin/destination coordinates for route generation. It shares shape-plugin's build infrastructure (`runStageTasks`, `VtTaskQueueDb`) and vector tile generation pipeline.

## UI Layer

### Dialog Steps

route-plugin provides a 5-step wizard via `PluginStepRegistry` (step 1 is provided by the common plugin):

| Step | ID | Component | Description |
| --- | --- | --- | --- |
| 1 | `basicInfo` | *(ui-plugin-basic-info)* | Basic info (name / description) — provided by `@hierarchidb/ui-plugin-basic-info` |
| 2 | `data-source` | `RouteDataSourceStep` | Data source selection (OSM / OpenFlights / searoute / IDE-GSM, etc.) |
| 3 | `route-config` | `RouteSelectionStep` | Country × transport mode selection matrix |
| 4 | `processing` | `RouteProcessingStep` | Build configuration (includes TileEmit settings card) |
| 5 | `build` | `RouteBuildStep` | Build execution and progress monitoring |
| 6 | `preview` | `RoutePreviewStep` | Map preview (optional) |

### Components

| Component | Description |
| --- | --- |
| `RouteDataSourceStep` | Data source selection UI (includes license confirmation) |
| `RouteSelectionStep` | Country × transport mode checkbox matrix (OR/AND toggle) |
| `RouteProcessingStep` | Build parameter settings (geometry / tileEmit config) |
| `RouteBuildStep` | Build execution and progress monitoring |
| `RoutePreviewStep` | MapLibre-based route preview |
| `RouteBuildLaunchForm` | Build launch form |
| `RouteBuildLiveProgress` | Real-time build progress display |
| `RouteBuildProgressBar` | Build progress bar |
| `RouteBuildSummary` | Build result summary |

### Icon

```typescript
// Entry point: @hierarchidb/route-plugin/icon
import { RoutePluginIcon } from '@hierarchidb/route-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `Route` |
| Emoji | 〰️ |
| Color | `#a3b030` |

## Worker Layer

### Worker preload

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerRouteWorkerStores'],
}
```

`registerRouteWorkerStores` registers stores in the Worker environment.

### FeatureStore / VectorTileStore

- `createRouteFeatureStoreDexie` — Creates a `FeatureStore<RouteFeature>` from `RouteDB` (`createDexieFeatureStore` wrapper)
- `createRouteVectorTileStoreDexie` — Creates a `VectorTileStore` from `RouteDB` (tile ID format: `${nodeId}-${z}-${x}-${y}`)

### Build Task Retrieval

`getBuildTasks(nodeId)` retrieves build tasks for a given node from `VtTaskQueueDb` and returns them as `BuildTaskSummary[]`.

### Tabular Build

`runRouteTabularBuild` generates route segments from tabular data:

1. `extractTabularRows` — Extracts row data from TabularDataApi
2. `materializeRouteSegmentsFromTabular` — Converts extracted rows into route segments and persists them

### Lifecycle

Route data CRUD operations are performed through the CoreDB TreeNode API and RouteDB:

- **Create**: Create a TreeNode + store settings in payload/draft
- **Build**: 3-stage parallel processing via `RouteBuildSession` (source → geometry → tileEmit)
- **Update**: Update TreeNode metadata + update route data in RouteDB
- **Delete**: Delete TreeNode + clean up route data in RouteDB

## Database Schema

route-plugin uses the Dexie-based `RouteDB` provided by `@hierarchidb/route-store`.

### Main Table (features)

```typescript
// plugin-manifest.ts — database definition
database: {
  dbName: 'route',
  tableName: 'features',
  version: 3,
  schema: {
    fields: [
      { name: 'id', indexed: true },
      { name: 'nodeId', indexed: true },
      { name: 'startLocationId', indexed: true },
      { name: 'endLocationId', indexed: true },
      { name: 'transportMode', indexed: true },
      { name: 'processingStatus', indexed: true },
      { name: 'createdAt', indexed: true },
      { name: 'updatedAt', indexed: true },
    ],
  },
}
```

### Vector Tile Table

`RouteVectorTileRecord` is stored in the `vectorTiles` table. Tile IDs follow the `${nodeId}-${z}-${x}-${y}` format and hold MVT binary data.

## Plugin Dependencies

```typescript
// PluginManifest
dependencies: ['shape'],
```

| Plugin | Relationship |
| --- | --- |
| `shape` | Required dependency — inherits build infrastructure (`runStageTasks`, `VtTaskQueueDb`) and vector tile pipeline |

Coordinates with location-plugin via origin/destination coordinates. When a location changes, cascading effects to routes are expected (cascade delete/update).

## Configuration

### Capabilities

```typescript
capabilities: {
  draft: true,           // draft mode support
  batch: true,           // batch processing support
  visualization: true,   // map visualization support
}
```

### Data Sources

route-plugin supports 8 data sources:

| Data Source | Display Name | License | Description |
| --- | --- | --- | --- |
| `openstreetmap` | OpenStreetMap | ODbL 1.0 | Routing baselines and reference data |
| `searoute` | searoute | MIT | Calculated maritime routes between ports |
| `openflights` | OpenFlights | ODbL 1.0 | Worldwide flight route data |
| `transitland` | Transitland | Varies by operator | GTFS feeds for public transit data |
| `searoute-js` | searoute-js | MIT | Calculated maritime routes between ports (JS) |
| `naturalearth-rivers` | Natural Earth Rivers | Public Domain | Major river systems |
| `ide-gsm` | IDE-GSM | IDE-GSM License | IDE-GSM schema files |
| `custom` | Custom | User provided | User-provided route data |

### Transport Modes (RouteMode)

| Mode | Constant | Default Color |
| --- | --- | --- |
| Airway | `ROUTE_MODES.AIRWAY` | `#1f77b4` |
| Waterway | `ROUTE_MODES.WATERWAY` | `#17becf` |
| High-speed railway | `ROUTE_MODES.H_RAILWAY` | `#d62728` |
| Railway | `ROUTE_MODES.RAILWAY` | `#ff7f0e` |
| Road | `ROUTE_MODES.ROAD` | `#2ca02c` |
| Highway | `ROUTE_MODES.HIGHWAY` | `#9467bd` |

### Build Configuration (RouteBuildConfig)

Default settings are defined in `DEFAULT_ROUTE_BUILD_CONFIG`:

| Category | Key Parameter | Default Value |
| --- | --- | --- |
| routeGeneration | method | `'direct'` |
| routeGeneration | parallel | `true` |
| routeGeneration | maxConcurrent | `4` |
| sourceConfig | maxConcurrent | `2` |
| sourceConfig | timeoutMs | `300000` |
| geometryConfig | enableFeatureFiltering | `true` |
| tileEmitConfig | format | `'mvt'` |
| tileEmitConfig | compression | `'gzip'` |
| tileEmitConfig | tileSize | `256` |

### i18n

| Field | Value |
| --- | --- |
| namespace | `route-plugin` |
| Locales | `en`, `ja` |

## Batch Processing

route-plugin declares `batch: true` and executes 3-stage batch processing via `RouteBuildSession` (extends `AbstractBuildSession`).

### Build Flow

```text
RouteBuildManager.startRouteBuildSession()
  → Generate RouteBuildTask[] (source / geometry / tileEmit)
  → Persist to VtTaskQueueDb
  → RouteBuildSession.processBatch()
    → runStageTasks('source')   — Route generation (RouteGenerator)
    → runStageTasks('geometry') — Geometry processing
    → runStageTasks('tileEmit') — Vector tile generation
```

### 3-Stage Pipeline

| Stage | Processing | Parallel Control |
| --- | --- | --- |
| `source` | Generate routes from origin/destination coordinates (`RouteGenerator`) | Lane policy with per-method concurrency |
| `geometry` | Geometry processing (simplification, filtering) | `geometryConfig.maxConcurrent` |
| `tileEmit` | MVT vector tile generation | `tileEmitConfig.maxConcurrent` |

### Lane Policy

The source stage uses `lanePolicy` to control per-method concurrency for route generation:

| Method | Default Concurrency |
| --- | --- |
| `osm_route` | 1 |
| `searoute` | 3 |
| `direct` | 64 |
| `great_circle` | 64 |
| `custom` | 8 |

### RouteBuildOrchestrationService

`RouteBuildOrchestrationService` provides high-level build orchestration:

| Method | Description |
| --- | --- |
| `startFromSources` | Fetch OD pairs from data sources and start build |
| `startMatrix` | Matrix build from origins × destinations |
| `startEnrich` | Enrichment build for existing routes |

### RouteSourceOrchestrator

`RouteSourceOrchestrator` handles data source strategy selection and execution:

- `TabularStrategy` — Tabular data sources (IDE-GSM, etc.)
- `GeoJsonStrategy` — GeoJSON data sources
- `FetchNetworkPort` for per-host connection management (4 connections), CORS proxy support

### Location Coordination

Route artifacts depend on location-plugin's origin/destination coordinates. Cascading effects on location changes:

- **Delete**: Cascade-delete referenced routes or cancel
- **Coordinate/admin code change**: Delete fetch cache + show `rebuild required` + schedule rebuild
- **Other field changes**: Immediately update route metadata

## Map Preview

route-plugin uses MapLibre GL JS to provide map preview for route data.

### Preview Features

- Display route data as LineString layers on the map after build completion
- Transport-mode coloring (6 modes: airway, waterway, high-speed railway, railway, road, highway)
- Line width adjustment (`lineWidth` parameter)
- Line style switching (solid / dashed / dotted)
- Per-transport-mode filtering toggles
- FloatingWindow overlay for metadata, transport mode toggles, and style settings

### Style Configuration

```typescript
import { buildDefaultRouteStyleConfig, mergeRouteStyleConfig } from '@hierarchidb/route-plugin/common';

// Default style configuration
const defaultStyle = buildDefaultRouteStyleConfig();
// { modeColors: { airway: '#1f77b4', ... }, lineWidth: 2, lineStyle: 'solid' }

// Merge with custom overrides
const customStyle = mergeRouteStyleConfig({
  lineWidth: 3,
  lineStyle: 'dashed',
});
```

### MapLibre Layer Expressions

`buildRouteColorExpression` generates a MapLibre `match` expression based on the `routeMode` property for transport-mode coloring. `resolveLineDashArray` returns a dash array for the given line style.

### Tabular Preview

After build execution, route data can be viewed in a table format via the data table tab. Supports multi-condition filtering (AND), column visibility toggling, and lazy-created `eq` condition indexes. `RouteTabularMetadataManager` handles tabular metadata management.

## Usage Examples

### Referencing the PluginManifest

```typescript
import { RoutePluginManifest } from '@hierarchidb/route-plugin/common';

console.log(RoutePluginManifest.nodeType); // 'route'
console.log(RoutePluginManifest.extends);  // 'shape'
console.log(RoutePluginManifest.dependencies); // ['shape']
```

### Using RoutePluginIcon

```tsx
import { RoutePluginIcon } from '@hierarchidb/route-plugin/icon';

<RoutePluginIcon sx={{ color: '#a3b030' }} />
```

### Referencing Data Source Definitions

```typescript
import { ROUTE_DATA_SOURCES } from '@hierarchidb/route-plugin/common';

// List all available data sources
ROUTE_DATA_SOURCES.forEach((ds) => {
  console.log(`${ds.displayName}: ${ds.license}`);
});

// Find a specific data source
const searoute = ROUTE_DATA_SOURCES.find((ds) => ds.name === 'searoute');
console.log(searoute?.displayName); // 'searoute'
```

### Route Style Configuration

```typescript
import {
  buildDefaultRouteStyleConfig,
  buildRouteColorExpression,
  resolveLineDashArray,
} from '@hierarchidb/route-plugin/common';

// Build a MapLibre color expression for route mode coloring
const style = buildDefaultRouteStyleConfig();
const colorExpr = buildRouteColorExpression(style);
// ['match', ['get', 'routeMode'], 'airway', '#1f77b4', ...]

// Resolve dash array for line style
const dashArray = resolveLineDashArray('dashed'); // [2, 2]
```

### Using RuntimeBridge

```typescript
import { RouteRuntimeBridge } from '@hierarchidb/route-plugin/common';

// Register runtime worker adapters (flag ROUTE_RUNTIME_WORKER=1 required)
await RouteRuntimeBridge.registerRuntimeWorkerAdapters();
```

## Directory Structure

```text
src/
├── plugin-manifest.ts                # PluginManifest definition
├── common/
│   ├── index.ts                      # Common public API entry point
│   ├── config/
│   │   └── buildConfig.ts            # DEFAULT_ROUTE_BUILD_CONFIG, mergeRouteBuildConfig
│   ├── datasource/
│   │   └── ROUTE_DATA_SOURCES.ts     # Data source config array (8 sources)
│   ├── entities/                     # Entity definitions
│   ├── i18n/
│   │   ├── en.ts                     # English translations
│   │   ├── ja.ts                     # Japanese translations
│   │   └── types.ts                  # i18n type definitions
│   ├── orchestrator/
│   │   ├── RouteBuildOrchestrationService.ts  # High-level build orchestration
│   │   ├── RouteSourceOrchestrator.ts         # Data source strategy orchestration
│   │   ├── TaskMapper.ts                      # OD pair → task mapping
│   │   ├── types.ts                           # Orchestrator types
│   │   └── strategies/                        # TabularStrategy, GeoJsonStrategy
│   ├── styles/
│   │   └── routeStyle.ts             # Route style config, color expressions
│   ├── tabular/
│   │   ├── createRouteTabularApi.ts           # Tabular API factory
│   │   └── RouteTabularMetadataManager.ts     # Tabular metadata manager
│   ├── types/
│   │   └── index.ts                  # RouteUpdaterPayload, TagId
│   └── utils/
│       └── draft.ts                  # Draft utilities
├── icon/
│   └── index.ts                      # RoutePluginIcon (re-export of MUI Route)
├── services/
│   ├── LocationResolver.ts           # Location coordinate resolution
│   ├── RouteBuildManager.ts          # Build session manager (task creation, session lifecycle)
│   ├── RouteBuildSession.ts          # Build session (3-stage pipeline with lane policy)
│   ├── RouteBuildSessionOrchestrator.ts  # Session orchestrator (extends BaseBuildSessionManager)
│   ├── build/
│   │   └── adapters/                 # Runtime worker adapter registration
│   ├── config/
│   │   ├── isFlagEnabled.ts          # Feature flag check
│   │   └── osrm-defaults.ts          # OSRM engine defaults
│   ├── engines/
│   │   ├── OsrmEngine.ts             # OSRM routing engine
│   │   └── types.ts                  # Engine types
│   ├── ide-gsm/
│   │   ├── applyIdeGsmWaypoints.ts   # IDE-GSM waypoint application
│   │   └── ideGsmCsv.ts             # IDE-GSM CSV import
│   └── net/
│       ├── getNetPort.ts             # Network port factory
│       └── ThrottledPort.ts          # Throttled network port
├── ui/
│   ├── index.ts                      # UI entry point (deprecated getDialogComponent)
│   ├── i18n.ts                       # i18n setup
│   ├── components/
│   │   ├── steps-provider.tsx        # PluginStepRegistry registration (5 steps)
│   │   ├── RouteBuildLaunchForm.tsx   # Build launch form
│   │   ├── RouteBuildLiveProgress.tsx # Live progress display
│   │   ├── RouteBuildProgressBar.tsx  # Progress bar
│   │   ├── RouteBuildSummary.tsx      # Build summary
│   │   ├── useRouteBuildLaunchForm.ts # Build launch form hook
│   │   └── steps/
│   │       ├── RouteBuildStep.tsx     # Build execution step
│   │       ├── RouteDataSourceStep.tsx # Data source selection
│   │       ├── RoutePreviewStep.tsx   # Map preview step
│   │       ├── RouteProcessingStep.tsx # Processing config step
│   │       └── RouteSelectionStep.tsx  # Country × mode selection
│   ├── hooks/
│   │   ├── useRouteBuildCrashInsight.ts  # Build crash insight hook
│   │   └── useRouteBuildProgress.ts      # Build progress hook
│   ├── locales/
│   │   ├── en.json                   # English translations
│   │   └── ja.json                   # Japanese translations
│   └── utils/
│       └── clearRouteDataSourceCache.ts  # Cache clearing
└── worker/
    ├── index.ts                      # Worker entry point (getBuildTasks, registerRouteWorkerStores)
    ├── createRouteFeatureStoreDexie.ts    # Dexie FeatureStore factory
    ├── createRouteVectorTileStoreDexie.ts # Dexie VectorTileStore factory
    ├── getBuildTasks.ts              # Build task retrieval from VtTaskQueueDb
    ├── factory/
    │   └── index.ts                  # Factory entry (re-export)
    └── tabular/
        ├── extractTabularRows.ts              # Tabular row extraction
        ├── materializeRouteSegmentsFromTabular.ts  # Tabular → RouteSegment conversion
        ├── progress.ts                        # Progress reporter type
        └── runRouteTabularBuild.ts            # Tabular build runner
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/route-plugin/common` | Type definitions, PluginManifest, data source definitions, style config, RuntimeBridge |
| `@hierarchidb/route-plugin/ui` | UI components (step registration, deprecated getDialogComponent) |
| `@hierarchidb/route-plugin/icon` | RoutePluginIcon |
| `@hierarchidb/route-plugin/worker` | Worker store registration, getBuildTasks |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — Plugin base (PluginManifest, PluginStepRegistry)
- [`@hierarchidb/core-types`](../packages/core-types/) — Shared type definitions (NodeId, NodeType, etc.)
- [`@hierarchidb/route-api`](../packages/route-api/) — Route API type definitions (RouteEntity, RouteBuildConfig, RouteMode)
- [`@hierarchidb/route-store`](../packages/route-store/) — Route data store (Dexie)
- [`@hierarchidb/route-engine`](../packages/route-engine/) — Route generation engine (RouteGenerator)
- [`@hierarchidb/location-api`](../packages/location-api/) — Location API type definitions
- [`@hierarchidb/location-store`](../packages/location-store/) — Location data store
- [`@hierarchidb/build-api`](../packages/build-api/) — Build API type definitions and session events
- [`@hierarchidb/build-runtime-services`](../packages/build-runtime-services/) — Build runtime services (BaseBuildSessionManager, AbstractBuildSession)
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — Worker runtime (FeatureStore, VectorTileStore)
- [`@hierarchidb/vt-orchestrator`](../packages/vt-orchestrator/) — Vector tile orchestrator (runStageTasks, VtTaskQueueDb)
- [`@hierarchidb/tabular-store`](../packages/tabular-store/) — Tabular data store
- [`@hierarchidb/tabular-source-xlsx`](../packages/tabular-source-xlsx/) — XLSX data source
- [`@hierarchidb/spreadsheet-plugin`](../plugins/spreadsheet-plugin/) — Tabular Preview coordination
- [`@hierarchidb/download`](../packages/download/) — Download service (FetchNetworkPort, CORS proxy)
- [`@hierarchidb/gis-sdk`](../packages/gis-sdk/) — GIS SDK
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode type definitions
- [`@hierarchidb/ui-map`](../packages/ui/map/) — Map UI components
- [`@hierarchidb/ui-build-progress`](../packages/ui/build-progress/) — Build progress UI
- [`@hierarchidb/ui-build-sessions`](../packages/ui/build-sessions/) — Build session management UI
- [`@hierarchidb/ui-country-select`](../packages/ui/country-select/) — Country selection UI
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — Plugin UI SDK

### Related Plugins

- [`shape-plugin`](../plugins/shape-plugin/) — Parent plugin (shared build infrastructure and vector tile pipeline)
- [`location-plugin`](../plugins/location-plugin/) — Provides origin/destination coordinates
- [`basemap-plugin`](../plugins/basemap-plugin/) — Base map for map preview
- [`styler-plugin`](../plugins/styler-plugin/) — Style coordination

## License

MIT
