# @hierarchidb/location-plugin

Last updated: 2026-04-05

A geographic location data management plugin for HierarchiDB. Batch-downloads point-of-interest (POI) data — airports, railway stations, ports, administrative centers, and more — from open data sources such as OpenStreetMap, GeoNames, OurAirports, OpenFlights, and World Port Index, persists them in IndexedDB, and visualizes them on a map. Supports BuildSession-based batch processing, multi-source parallel downloads, and MapLibre-based map preview with clustering and heatmap modes.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `location` |
| extends | `folder` |
| category | `geographic` (menuGroup: `geo`, createOrder: `40`) |
| priority | `40` |

location-plugin inherits from folder-plugin and provides POI collection, management, and visualization. Through Shape integration, location points can be linked to shape-plugin features via centroid coordinates.

## UI Layer

### Dialog Steps

location-plugin provides a `PluginStepRegistry`-based 3-step wizard (step 1 is provided by the common plugin):

| Step | ID | Component | Description |
| --- | --- | --- | --- |
| 1 | `basicInfo` | *(ui-plugin-basic-info)* | Basic info (name / description) — provided by `@hierarchidb/ui-plugin-basic-info` |
| 2 | `data-source` | `LocationDataSourceStep` | Data source selection (OSM / GeoNames / OurAirports, etc.), IDE-GSM CSV import |
| 3 | `selection` | `LocationSelectionStep` | Country × location type selection matrix |
| 4 | `map-preview` | `LocationMapPreviewStep` | Location data map preview (optional) |

### Components

| Component | Description |
| --- | --- |
| `LocationDataSourceStep` | Data source selection UI (includes license confirmation) |
| `LocationSelectionStep` | Country × location type checkbox matrix |
| `LocationMapPreviewStep` | MapLibre-based location preview (markers, clusters, heatmap) |
| `LocationBuildParametersStep` | Build parameter configuration |
| `LocationLicenseStep` | License agreement step |
| `LocationStyleConfigPanel` | Location display style configuration panel |
| `BuildProgressDialog` | Build progress dialog |
| `LocationMapPreview` | Map preview component |
| `LocationPanel` | Node detail panel |

### Icon

```typescript
// Entry point: @hierarchidb/location-plugin/icon
import { LocationPluginIcon } from '@hierarchidb/location-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `LocationOn` |
| Emoji | 📍 |
| Color | `#a3b030` |

## Worker Layer

### Worker preload

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerLocationWorkerStores', 'loadLocationEntitiesDbModule'],
}
```

`registerLocationWorkerStores` registers stores in the Worker environment, and `loadLocationEntitiesDbModule` lazily loads the LocationDB module.

### FeatureStore

`createLocationFeatureStoreDexie` creates a `FeatureStore<LocationGroupItemData>` backed by `LocationDB`. It provides `list` / `bulkUpsert` / `bulkDelete` operations and assigns Morton key spatial indices.

### Data Normalization

`normalizers.ts` handles Worker-layer data normalization:

- `normalizePeerData` — Normalizes `LocationPeerData` (schemaVersion: 1)
- `normalizeGroupData` — Normalizes `LocationGroupItemData` (including schemaVersion 1→2 migration)
- `toGroupRow` / `fromGroupRow` — Converts between `FeatureItemBase` and `LocationFeature`

### Lifecycle

Location data CRUD operations are performed through the CoreDB TreeNode API and LocationDB:

- **Create**: Create TreeNode + store configuration in payload/draft
- **Build**: Parallel download, filter, and persist via `LocationBuildSession`
- **Update**: Update TreeNode metadata + update point data in LocationDB
- **Delete**: Delete TreeNode + clean up point data in LocationDB

## Database Schema

location-plugin uses the Dexie-based `LocationDB` provided by `@hierarchidb/location-store`.

### Main Table (features)

```typescript
// plugin-manifest.ts — database definition
database: {
  dbName: 'location',
  tableName: 'features',
  version: 12,
  schema: {
    fields: [
      { name: 'nodeId', indexed: true },
      { name: 'id', indexed: true },
      { name: 'type', indexed: true },
      { name: 'mortonKey', indexed: true },
      { name: 'updatedAt', indexed: true },
    ],
  },
}
```

### LocationFeature Record

```typescript
interface LocationFeature {
  nodeId: NodeId;
  id: string;
  type: string;                    // location type (airport, port, etc.)
  mortonKey?: number;              // spatial index via Morton curve
  data?: LocationGroupItemData;    // point properties
  centroidForShapeId?: number;     // linked Shape feature ID
  centroidForShapeContainerNodeId?: NodeId;  // linked Shape node
  updatedAt: number;
}
```

### LocationGroupItemData (schemaVersion: 2)

```typescript
interface LocationGroupItemData {
  schemaVersion: 2;
  pointId: string;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  admin0Code: string;              // ISO 3166-1 alpha-2
  admin0?: string;                 // country name
  admin1?: string;                 // first-level admin division
  admin2?: string;                 // second-level admin division
  centroidForShapeId?: number;
  centroidForShapeContainerNodeId?: NodeId;
  metadata?: Record<string, string | number | null>;
}
```

## Plugin Dependencies

```typescript
// PluginManifest
dependencies: ['folder'],
```

| Plugin | Relationship |
| --- | --- |
| `folder` | Required — inherits base node type |

`spreadsheet-plugin` is declared as a peerDependency for Tabular Preview integration. `shape-plugin` is linked via the `centroidForShapeId` / `centroidForShapeContainerNodeId` fields.

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

location-plugin supports 8 data sources:

| Data Source | Display Name | License | Supported Types | Update Frequency |
| --- | --- | --- | --- | --- |
| `openstreetmap-overpass` | OpenStreetMap (Overpass API) | ODbL 1.0 | All types | Realtime |
| `openstreetmap-nominatim` | OpenStreetMap (Nominatim) | ODbL 1.0 | All types | Realtime |
| `geonames` | GeoNames | CC BY 4.0 | All types | Daily |
| `natural-earth` | Natural Earth | Public Domain | Admin, airport, port | Irregular |
| `ourairports` | OurAirports | Public Domain | Airport | Weekly |
| `openflights` | OpenFlights | ODbL 1.0 | Airport, station | Irregular |
| `world-port-index` | World Port Index | Public Domain | Port | Yearly |
| `ide-gsm` | IDE-GSM | IDE-GSM License | All types | Irregular |

### Location Types (LocationType)

| Type | Description | OSM Tag |
| --- | --- | --- |
| `airport` | Airport | `aeroway=aerodrome` |
| `railway_station` | Railway station | `railway=station` |
| `port` | Port / harbor | `harbour=yes` |
| `interchange` | Highway interchange | `highway=motorway_junction` |
| `area_centroid` | Area centroid (fallback) | — |

### i18n

| Field | Value |
| --- | --- |
| namespace | `location-plugin` |
| Locales | `en`, `ja` |

## Batch Processing

location-plugin declares `batch: true` and executes batch processing via `LocationBuildSession` (extends `AbstractBuildSession`).

### Build Flow

```text
searchConfigs → [parallel batches] → searchLocations → validateAndFilter → persistLocationPoints
```

1. `LocationBuildManager.startLocationBuildSession(nodeId, config)` starts a session
2. `LocationBuildSession.processBatch()` splits `searchConfigs` into parallel batches
3. Each batch executes `searchLocations()` → `validateAndFilterLocations()` → `persistLocationPoints()`
4. Progress is reported to the UI via `updateProgress()`

### Parallel Downloads

`LocationBuildConfig.processingOptions.concurrent` controls parallelism (default: 1). `FetchNetworkPort` manages per-host concurrency (4) and supports CORS proxy requests.

### Per-Source Search Methods

`LocationBuildSession` preferentially uses strategies registered in `strategyRegistry`, falling back to built-in search methods:

| Method | Data Source | Processing |
| --- | --- | --- |
| `searchOSM` | Nominatim | Geocoding search |
| `searchOverpass` | Overpass API | OSM tag-based spatial search |
| `searchGeoNames` | GeoNames API | Gazetteer search |
| `searchOurAirports` | OurAirports CSV | Airport CSV parsing |
| `searchOpenFlights` | OpenFlights CSV | Airport CSV parsing |
| `searchWorldPortIndex` | WPI CSV | Port CSV parsing |
| `searchCustom` | Custom endpoint | User-specified API |

### Country Code Normalization

`normalizeCountryCodes()` uses `@hierarchidb/gen-iso3166-2` ISO 3166 data to normalize alpha-3 / country names → alpha-2.

### Filtering

`validateAndFilterLocations()` filters by:

- `allowedTypes` — Permitted location types
- `countryCodes` / `countryNames` — Country code / name filter
- `excludeIds` — Excluded point IDs

### Point Persistence

`pointRepository.ts` provides CRUD operations against LocationDB:

| Function | Description |
| --- | --- |
| `appendLocationPoints` | Append to existing data |
| `replaceLocationPoints` | Replace all data |
| `replaceLocationPointsChunked` | Replace in chunks (with progress callback) |
| `listLocationPoints` | Retrieve all points for a node |
| `deleteLocationPoints` | Delete points by ID |
| `clearLocationPoints` | Clear all points for a node |

## Map Preview

location-plugin provides a MapLibre GL JS-based map preview for location data.

### Preview Features

- Display location data as markers on the map after build completion
- Display mode switching: points / clustering / heatmap
- Filtering by location type (airport, railway station, port, admin center, interchange)
- Popup with detailed information on marker click
- Overlay with basemap layers

### Preview Component Structure

```text
LocationMapPreviewStep
├── LocationMapPreview           # Main map component
├── LocationMapPreviewMarkers    # Marker rendering
├── useLocationMapPreview        # Map state management
├── useLocationMapPreviewMap     # MapLibre instance management
├── useLocationMapPreviewMetadata # Metadata loading
└── useLocationPreviewConfig     # Preview configuration
```

### Tabular Preview

After a build, location data can be browsed in the "Data Table" tab of the BuildProgressDialog. Supports multi-condition filtering (AND), column visibility toggling, and lazy index creation for `eq` conditions. `LocationTabularMetadataManager` handles tabular metadata management.

## Shape Integration

location-plugin integrates with shape-plugin through the following fields:

- `centroidForShapeId` — Shape feature ID (centroid linkage target)
- `centroidForShapeContainerNodeId` — Shape container node's NodeId

This integration enables linking location point centroids to Shape administrative region features for geographic analysis.

## Usage Examples

### Referencing the PluginManifest

```typescript
import { LocationPluginManifest } from '@hierarchidb/location-plugin/common';

console.log(LocationPluginManifest.nodeType); // 'location'
console.log(LocationPluginManifest.capabilities.batch); // true
```

### Using LocationPluginIcon

```tsx
import { LocationPluginIcon } from '@hierarchidb/location-plugin/icon';

<LocationPluginIcon sx={{ color: '#a3b030' }} />
```

### Referencing Data Source Definitions

```typescript
import { getLocationDataSource, getLocationDataSourcesByType } from '@hierarchidb/location-plugin/common';

// Look up a specific data source
const ourAirports = getLocationDataSource('ourairports');
console.log(ourAirports?.name); // 'OurAirports'

// Find data sources supporting airport type
const airportSources = getLocationDataSourcesByType('airport');
console.log(airportSources.length); // multiple sources
```

## Directory Structure

```text
src/
├── plugin-manifest.ts                # PluginManifest definition
├── locationEntitiesDB.ts             # Re-export of LocationDB from location-store
├── common/
│   ├── index.ts                      # Common public API entry point
│   ├── components/
│   │   ├── LocationDialog.tsx        # Location dialog component
│   │   └── LocationPanel.tsx         # Location panel component
│   ├── datasources/
│   │   ├── LOCATION_DATA_SOURCES.ts  # Data source config array
│   │   ├── LocationDataSourceDefinitions.ts  # Data source definitions (8 sources)
│   │   └── resolveLocationAttribution.ts     # Attribution resolution
│   ├── entities/
│   │   ├── LocationEntity.ts         # LocationEntity, LocationBuildConfig types
│   │   └── LocationPoint.ts          # LocationPointProperties type
│   ├── hooks/
│   │   └── useLocationProgress.ts    # Location progress hook
│   ├── i18n/
│   │   ├── formatters.ts            # i18n formatters
│   │   └── index.ts                 # i18n entry
│   ├── tabular/
│   │   ├── createLocationTabularApi.ts          # Tabular API factory
│   │   └── LocationTabularMetadataManager.ts    # Tabular metadata manager
│   ├── types/
│   │   ├── entities.ts              # Re-exports from location-api
│   │   ├── index.ts                 # Type definitions (LocationDraft, UpdateLocationData, etc.)
│   │   └── payloads.ts             # Payload types
│   └── utils/
│       └── isDevEnvironment.ts      # Dev environment detection
├── icon/
│   └── index.ts                     # LocationPluginIcon (re-export of MUI LocationOn)
├── services/
│   ├── index.ts                     # Service exports (BuildManager, BuildSession, pointRepository)
│   ├── LocationBuildManager.ts      # Build session manager (extends BaseBuildSessionManager)
│   ├── LocationBuildSession.ts      # Build session (extends AbstractBuildSession)
│   ├── pointFactories.ts           # OSM/Overpass point property builders
│   ├── pointRepository.ts          # Point CRUD operations (append, replace, list, delete, clear)
│   ├── download/
│   │   ├── csvSources.ts           # CSV parsers (OurAirports, OpenFlights, WorldPortIndex)
│   │   ├── csvUtils.ts             # CSV utility functions
│   │   ├── mappers.ts              # Type/number mappers
│   │   ├── rawTypes.ts             # Raw API response types
│   │   ├── strategyRegistry.ts     # Data source strategy registry
│   │   └── types.ts                # Download types
│   └── ide-gsm/
│       └── ideGsmCsv.ts            # IDE-GSM CSV import
├── ui/
│   ├── index.ts                     # UI entry point (step registration)
│   ├── i18n.ts                      # i18n setup
│   ├── components/
│   │   ├── steps-provider.tsx       # PluginStepRegistry registration (3 steps)
│   │   ├── batch/
│   │   │   ├── BuildProgressDialog.tsx         # Build progress dialog
│   │   │   ├── LocationMapPreview.tsx          # Map preview component
│   │   │   ├── LocationMapPreviewMarkers.tsx   # Marker rendering
│   │   │   ├── locationMapPreviewTypes.ts      # Preview type definitions
│   │   │   └── useLocationMapPreview.ts        # Map preview hook
│   │   └── steps/
│   │       ├── LocationBuildParametersStep.tsx  # Build parameters
│   │       ├── LocationDataSourceStep.tsx       # Data source selection
│   │       ├── LocationLicenseStep.tsx          # License agreement
│   │       ├── LocationMapPreviewStep.tsx       # Map preview step
│   │       ├── LocationSelectionStep.tsx        # Country × type selection
│   │       ├── LocationStyleConfigPanel.tsx     # Style configuration
│   │       └── ... (hooks and utilities)
│   ├── hooks/
│   │   └── useIdeGsmImportOnEntry.ts  # IDE-GSM auto-import hook
│   ├── locales/
│   │   ├── en.json                  # English translations
│   │   └── ja.json                  # Japanese translations
│   ├── state/
│   │   └── ideGsmProgress.ts        # IDE-GSM progress state
│   └── utils/
│       ├── clearLocationDataSourceCache.ts  # Cache clearing
│       └── ideGsmSelection.ts       # IDE-GSM selection utilities
└── worker/
    ├── index.ts                     # Worker entry point
    ├── locationEntitiesDB.ts        # LocationDB re-export
    ├── createLocationFeatureStoreDexie.ts  # Dexie FeatureStore factory
    ├── normalizers.ts               # Data normalization (PeerData, GroupData, Morton key)
    ├── factory/
    │   ├── index.ts                 # Factory entry
    │   └── registerLocationWorkerStores.ts  # Worker store registration
    └── tabular/
        ├── extractTabularRows.ts              # Tabular row extraction
        ├── materializeLocationPointsFromTabular.ts  # Tabular → LocationPoint conversion
        └── runLocationTabularBuild.ts         # Tabular build runner
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/location-plugin/common` | Type definitions, PluginManifest, data source definitions, attribution |
| `@hierarchidb/location-plugin/ui` | UI components (step registration, panel) |
| `@hierarchidb/location-plugin/icon` | LocationPluginIcon |
| `@hierarchidb/location-plugin/worker` | Worker store registration, LocationDB module loader |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — Plugin base (PluginManifest, PluginStepRegistry)
- [`@hierarchidb/core-types`](../packages/core-types/) — Shared type definitions (NodeId, NodeType, ISO2, etc.)
- [`@hierarchidb/folder-plugin`](../plugins/folder-plugin/) — Base node type (inherited)
- [`@hierarchidb/location-store`](../packages/location-store/) — Location data store (Dexie)
- [`@hierarchidb/location-api`](../packages/location-api/) — Location API type definitions
- [`@hierarchidb/build-api`](../packages/build-api/) — Build API type definitions and session events
- [`@hierarchidb/build-runtime-services`](../packages/build-runtime-services/) — Build runtime services (BaseBuildSessionManager, AbstractBuildSession)
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — Worker runtime (FeatureStore)
- [`@hierarchidb/worker-api`](../packages/worker-api/) — Worker API
- [`@hierarchidb/tabular-store`](../packages/tabular-store/) — Tabular data store
- [`@hierarchidb/tabular-source`](../packages/tabular-source/) — Tabular data source
- [`@hierarchidb/tabular-source-xlsx`](../packages/tabular-source-xlsx/) — XLSX data source
- [`@hierarchidb/gen-iso3166-2`](../packages/tools/gen-iso3166-2/) — ISO 3166-2 code generation and country code normalization
- [`@hierarchidb/download`](../packages/download/) — Download service (FetchNetworkPort, CORS proxy)
- [`@hierarchidb/gis-sdk`](../packages/gis-sdk/) — GIS SDK
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode type definitions
- [`@hierarchidb/ui-map`](../packages/ui/map/) — Map UI components
- [`@hierarchidb/ui-build-progress`](../packages/ui/build-progress/) — Build progress UI
- [`@hierarchidb/ui-build-sessions`](../packages/ui/build-sessions/) — Build session management UI
- [`@hierarchidb/ui-country-select`](../packages/ui/country-select/) — Country selection UI
- [`@hierarchidb/ui-tabular`](../packages/ui/tabular-extract/) — Tabular data extraction UI
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — Plugin UI SDK

### Related Plugins

- [`shape-plugin`](../plugins/shape-plugin/) — Shape data integration (centroidForShapeId linkage)
- [`basemap-plugin`](../plugins/basemap-plugin/) — Basemap for map preview
- [`spreadsheet-plugin`](../plugins/spreadsheet-plugin/) — Tabular Preview integration
- [`route-plugin`](../plugins/route-plugin/) — Route generation (location data integration)

## License

MIT
