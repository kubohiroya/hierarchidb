# @hierarchidb/basemap-plugin

Last updated: 2026-04-05

A plugin that manages shared map styles and viewports for HierarchiDB's tree structure. Using MapLibre GL JS, it persists basemap configuration (style presets, custom style URLs, and initial viewport) that ancestor nodes in the tree use as their basemap. Descendant nodes (shape-plugin, location-plugin, etc.) inherit this configuration for map rendering.

## Node Type and Inheritance

| Field | Value |
| --- | --- |
| nodeType | `basemap` |
| extends | `folder` |
| category | `geographic` |
| priority | `900` |

basemap-plugin inherits from folder-plugin, adding map style and viewport management on top of the folder's container functionality. It can have child nodes but cannot be a root node.

## UI Layer

### Dialogs (Multi-Step)

basemap-plugin uses the `PluginStepRegistry`-based step registration pattern, adding two extended steps to the folder dialog.

Step registration is handled in `src/ui/components/steps-provider.tsx`, providing steps for the `basemap` nodeType:

| Step # | Label | Content | Validation |
| --- | --- | --- | --- |
| 1 | Basic Info | Basic information (provided by `@hierarchidb/ui-plugin-basic-info`) | — |
| 2 | Map Style | Preset cards (`streets`, `satellite`, `terrain`, `dark`, `light`) + "Custom" card with URL input | Style must be selected; when `custom`, URL must be a valid absolute URL |
| 3 | Map Viewport | Longitude/latitude/zoom/bearing input fields + interactive MapLibre map preview | Longitude in [-180, 180], latitude in [-90, 90], zoom in [0, 24], bearing in [-180, 180] |

Step gating is sequential (step 2 must validate before step 3 is unlocked). Submit is enabled only when all steps pass validation.

### Components

| Component | Description |
| --- | --- |
| `BaseMapDisplay` | MapLibre-powered map viewer that renders the persisted style + viewport |
| `BaseMapPreview` | Lightweight preview card used inside dialogs or summaries |
| `MapStyleStep` | Map style selection step with presets + custom URL input |
| `ViewportStep` | Viewport configuration step with numeric inputs + interactive map |

### Icon

```typescript
// Entry point: @hierarchidb/basemap-plugin/icon
import { BasemapPluginIcon } from '@hierarchidb/basemap-plugin/icon';
```

| Field | Value |
| --- | --- |
| MUI icon | `Public` |
| Emoji | 🌍 |
| Color | `#b0b3d9` |

## Worker Layer

basemap-plugin synchronizes `mapStyle` and `viewport` to the Worker side through the peer store. The Worker `preload` configuration registers `registerBasemapWorkerStores`.

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerBasemapWorkerStores'],
}
```

### EntityHandler

`BaseMapEntityHandler` extends `BaseEntityHandler` and performs:

- Entity normalization and validation
- Mirroring every change into the peer store so Worker consumers receive the same `mapStyle`/`viewport`

### Lifecycle

Basemap CRUD operations are performed through the TreeNode API + Dexie database:

- **Create**: Create a TreeNode + persist BaseMapEntity in Dexie
- **Update**: Update mapStyle/viewport via TreeNodeUpdater + peer store sync
- **Delete**: Cascades with TreeNode deletion
- **Read**: Entity fetching and caching via the `useBaseMapEntity` hook

## Database Schema

### Dexie Database

| Field | Value |
| --- | --- |
| Database name | `basemap-db` |
| Tables | `baseMaps`, `workingCopies` |
| Indexes | `id`, `nodeId`, `createdAt`, `updatedAt` |

### Entity Model

```typescript
interface BaseMapEntity extends PeerEntity<BaseMapEntityPayload> {
  id: NodeId;
  mapStyle: MapStyle;
  viewport: MapViewport;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface MapStyle {
  style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
  customStyleUrl?: string;
  customStyleConfig?: Record<string, unknown>;
}

interface MapViewport {
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  bearing: number;
  pitch: number;
}
```

Tree node metadata (name, description, tags, etc.) is intentionally not duplicated in the basemap document. All hierarchical context is handled by the surrounding folder node.

### Peer Store

```typescript
type BasemapPeerData = {
  schemaVersion: 1;
};
```

The peer store keeps `{ schemaVersion: 1, presentation: { style, viewport } }` and nothing else, keeping the Worker payload small and deterministic.

## Plugin Dependencies

```typescript
// PluginManifest.dependencies
dependencies: ['folder']
```

basemap-plugin depends on folder-plugin. It inherits folder's container functionality (child node management, name/description management) and adds map style and viewport management.

## Configuration

### Capabilities

```typescript
capabilities: {
  canHaveChildren: true,   // child nodes allowed
  canBeRoot: false,        // cannot be a root node
  canBeDeleted: true,
  canBeRenamed: true,
  canBeMoved: true,
  canBeCopied: true,
}
```

### Schema

```typescript
schema: {
  inherits: 'folder',
  fields: [
    { name: 'mapStyle', type: 'object', required: true },
    { name: 'viewport', type: 'object', required: true },
  ],
}
```

### Validation Constants

| Constant | Value | Description |
| --- | --- | --- |
| `LONGITUDE_MIN` / `LONGITUDE_MAX` | -180 / 180 | Longitude range |
| `LATITUDE_MIN` / `LATITUDE_MAX` | -90 / 90 | Latitude range |
| `ZOOM_MIN` / `ZOOM_MAX` | 0 / 24 | Zoom level range |
| `BEARING_MIN` / `BEARING_MAX` | 0 / 360 | Bearing range |
| `PITCH_MIN` / `PITCH_MAX` | 0 / 60 | Pitch range |

### Default Viewport

```typescript
const DEFAULT_VIEWPORT: MapViewport = {
  center: [139.6917, 35.6895], // Tokyo
  zoom: 10,
  bearing: 0,
  pitch: 0,
};
```

### i18n

| Field | Value |
| --- | --- |
| namespace | `basemap-plugin` |
| Locales | `en`, `ja` |

## Map Preview

basemap-plugin provides map preview capabilities powered by MapLibre GL JS.

### Built-in Style Presets

| Preset | Provider / URL | Notes |
| --- | --- | --- |
| `streets` | CARTO Voyager (`basemaps.cartocdn.com`) | Default; free |
| `satellite` | MapLibre Demo Tiles (`demotiles.maplibre.org`) | Demo satellite tiles (no API key) |
| `terrain` | CARTO Voyager | Reused CARTO Voyager for terrain view |
| `dark` | CARTO Dark Matter | Dark theme |
| `light` | CARTO Positron | Light theme |
| `custom` | User-provided | Requires `customStyleUrl` or `customStyleConfig` |

Premium providers (Mapbox, MapTiler, etc.) are listed for reference but are not wired up yet. Callers can inject their own style via `customStyleUrl`.

### BaseMapDisplay

`BaseMapDisplay` is a full-featured MapLibre map viewer component. It renders the persisted style and viewport, supporting interactive operations (drag, zoom, rotate).

```tsx
import { BaseMapDisplay } from '@hierarchidb/basemap-plugin/ui';

<BaseMapDisplay
  nodeId={nodeId}
  width="100%"
  height={420}
  interactive={true}
  onLoad={(map) => console.log('Map loaded', map)}
  onViewStateChange={(vs) => console.log('View changed', vs)}
/>
```

### BaseMapPreview

`BaseMapPreview` is a lightweight preview card component. Used in dialogs and summary views, it overlays style icons, coordinate information, and attribution.

```tsx
import { BaseMapPreview } from '@hierarchidb/basemap-plugin/ui';

<BaseMapPreview
  mapStyle={{ style: 'streets' }}
  viewport={{ center: [139.6917, 35.6895], zoom: 10, bearing: 0, pitch: 0 }}
  height={240}
  showMetadata={true}
  interactive={false}
/>
```

In non-interactive mode, clicking the preview opens the map view in a new tab.

### ViewportStep (In-Dialog Preview)

In dialog step 3, an interactive MapLibre map is embedded where users can adjust the viewport via drag, wheel, and double-click. Numeric input fields and the map are bidirectionally synchronized.

## Usage Examples

### Referencing the PluginManifest

```typescript
import { BaseMapPluginManifest } from '@hierarchidb/basemap-plugin';

console.log(BaseMapPluginManifest.nodeType); // 'basemap'
console.log(BaseMapPluginManifest.capabilities.canHaveChildren); // true
console.log(BaseMapPluginManifest.extends); // 'folder'
```

### Configuring Custom Styles

```typescript
// Using a custom style URL
const mapStyle = {
  style: 'custom' as const,
  customStyleUrl: 'https://example.com/styles/city-night.json',
};

// Using an inline MapLibre style config
const inlineStyle = {
  style: 'custom' as const,
  customStyleConfig: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  },
};
```

### Using the useBaseMapEntity Hook

```typescript
import { useBaseMapEntity } from '@hierarchidb/basemap-plugin/ui';

function BasemapEditor({ nodeId }: { nodeId: NodeId }) {
  const { entity, loading, error, refetch, updateEntity } = useBaseMapEntity(nodeId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!entity) return <div>No basemap configured</div>;

  return (
    <div>
      <p>Style: {entity.mapStyle.style}</p>
      <p>Center: {entity.viewport.center.join(', ')}</p>
      <p>Zoom: {entity.viewport.zoom}</p>
    </div>
  );
}
```

### Viewport Validation

```typescript
import { validateViewport, formatCoordinates } from '@hierarchidb/basemap-plugin';

const viewport = { center: [139.6917, 35.6895], zoom: 10, bearing: 0, pitch: 0 };
const isValid = validateViewport(viewport); // true

const formatted = formatCoordinates(139.6917, 35.6895); // '139.6917, 35.6895'
```

## Directory Structure

```text
src/
├── index.ts                          # Root entry point (types + manifest + constants)
├── plugin-manifest.ts                # PluginManifest definition
├── common/
│   ├── constants/
│   │   ├── builtInStyles.ts          # Built-in MapLibre style definitions and URLs
│   │   └── constants.ts              # Validation limits, default viewport, style presets
│   ├── shared/
│   │   ├── BaseMapPluginManifest.ts  # Re-export of plugin manifest
│   │   ├── viewportValidation.ts     # Viewport validation utilities
│   │   └── index.ts                  # Shared exports
│   └── types/
│       ├── BASEMAP_CATEGORIES.ts     # Basemap category type definitions
│       ├── BaseMapEntity.ts          # Entity, draft, search criteria, peer data types
│       ├── types.ts                  # MapViewport, BaseMapStylePreset, BaseMapConfig
│       └── index.ts                  # Type exports
├── icon/
│   └── index.ts                      # BasemapPluginIcon (re-export of MUI Public)
└── ui/
    ├── i18n.ts                       # i18n resource registration (en, ja)
    ├── index.ts                      # UI entry point
    ├── components/
    │   ├── BaseMapDisplay.tsx         # Full MapLibre map viewer component
    │   ├── BaseMapPreview.tsx         # Lightweight preview card component
    │   ├── getBasemapStepConfigs.tsx  # Step configuration factory
    │   ├── steps-provider.tsx         # PluginStepRegistry registration
    │   ├── useBaseMapDisplay.ts       # Hook for BaseMapDisplay
    │   ├── useBaseMapPreview.ts       # Hook for BaseMapPreview
    │   ├── index.ts                   # Component exports
    │   └── steps/
    │       ├── MapStyleStep.tsx       # Map style selection step
    │       ├── ViewportStep.tsx       # Viewport configuration step with map
    │       ├── useViewportStep.ts     # Hook for ViewportStep
    │       └── index.ts              # Step exports
    ├── hooks/
    │   ├── useBaseMapEntity.ts        # Entity fetch/update/validation hooks
    │   ├── useMapStyleStep.ts         # Map style step logic hook
    │   └── index.ts                   # Hook exports
    ├── locales/
    │   ├── en.json                    # English locale
    │   └── ja.json                    # Japanese locale
    └── utils/
        └── mapStyle.ts               # Style URL resolution utilities
```

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/basemap-plugin` | Type definitions, PluginManifest, constants, validation utilities |
| `@hierarchidb/basemap-plugin/ui` | UI components (BaseMapDisplay, BaseMapPreview, step registration, hooks) |
| `@hierarchidb/basemap-plugin/icon` | BasemapPluginIcon |

## Related Plugins and Packages

### Dependencies

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — Plugin base (PluginManifest, PluginStepRegistry)
- [`@hierarchidb/core-types`](../packages/core-types/) — Shared type definitions (NodeId, NodeType, etc.)
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode, TreeNodeUpdater type definitions
- [`@hierarchidb/folder-plugin`](../plugins/folder-plugin/) — Parent plugin (container functionality)
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — Plugin UI SDK (useTreeNodeUpdater, etc.)
- [`@hierarchidb/plugin-service-api`](../packages/plugin-service-api/) — Plugin service API
- [`@hierarchidb/ui-plugin-basic-info`](../packages/ui/plugin-basic-info/) — Plugin basic info step
- [`@hierarchidb/ui-map`](../packages/ui/map/) — MapLibre map component foundation
- [`@hierarchidb/ui-i18n`](../packages/ui/i18n/) — Internationalization foundation
- [`@hierarchidb/ui-worker-provider`](../packages/ui/worker-provider/) — Worker client provider
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — Worker runtime
- [`@hierarchidb/util`](../packages/util/) — Utilities

### Plugins Using basemap-plugin

The basemap style and viewport configured by basemap-plugin are referenced by the following plugins for map rendering:

- [`shape-plugin`](../plugins/shape-plugin/) — Shape data map display
- [`location-plugin`](../plugins/location-plugin/) — Location entity map display
- [`route-plugin`](../plugins/route-plugin/) — Route map display

## License

MIT
