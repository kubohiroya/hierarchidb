# @hierarchidb/plugin-basemap

Basemap plugin for HierarchiDB nodes.  
The current implementation focuses on persisting a MapLibre style reference and a default viewport per tree node, and wiring those values into the shared multi-step dialog runtime.

- **Node type**: `basemap`
- **Persistence**: Dexie (`basemap-db`) tables `baseMaps` / `workingCopies`
- **UI hooks**: Map style step + viewport step, plus reusable view components (`BaseMapPanel`, `BaseMapDisplay`, `BaseMapPreview`)
- **Worker sync**: peer store keeps `mapStyle` + `viewport` only (no custom metadata payload today)

## Table of Contents

- [Installation](#installation)
- [Entity Model](#entity-model)
- [Built-in Style Presets](#built-in-style-presets)
- [Multi-Step Dialog Integration](#multi-step-dialog-integration)
- [UI Components](#ui-components)
- [Persistence & Worker Sync](#persistence--worker-sync)
- [Usage Example](#usage-example)
- [Testing & Validation](#testing--validation)
- [Future Work](#future-work)

## Installation

```bash
pnpm add @hierarchidb/plugin-basemap

# peer deps expected by the UI package
pnpm add maplibre-gl @mui/material @mui/icons-material \
  @hierarchidb/plugin-base @hierarchidb/plugin-ui-sdk
```

To register the step provider + components inside the UI shell:

```ts
// executed once in the host UI bootstrap
import '@hierarchidb/plugin-basemap/ui';
```

## Entity Model

`src/common/types/BaseMapEntity.ts` defines the only persisted fields:

```ts
interface BaseMapEntity extends BaseEntity<NodeId> {
  nodeId: NodeId;
  mapStyle: {
    style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
    customStyleUrl?: string;
    customStyleConfig?: Record<string, unknown>;
  };
  viewport: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
}
```

There is intentionally **no** duplication of tree-node metadata (name, description, tags, children, etc.) in the basemap document. All hierarchical context is handled by the surrounding folder node.

Working copies share the same shape (map style + viewport) and are materialised through Dexie to support offline edits.

## Built-in Style Presets

`src/common/constants/builtInStyles.ts` contains the preset map styles the UI exposes:

| preset      | provider / URL                                                   | Notes                                  |
|-------------|------------------------------------------------------------------|----------------------------------------|
| `streets`   | `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json`   | default; free                          |
| `satellite` | `https://demotiles.maplibre.org/style.json`                      | demo satellite tiles (no key)          |
| `terrain`   | `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json`   | reused CARTO Voyager for terrain view  |
| `dark`      | `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` | dark matter theme                    |
| `light`     | `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`  | Positron light theme                   |
| `custom`    | requires `customStyleUrl` or `customStyleConfig`                  | user-provided MapLibre style JSON      |

Premium providers (Mapbox, MapTiler, …) are listed for reference but are not wired up yet; callers are expected to inject their own `customStyleUrl`.

### Custom style example

```ts
const mapStyle = {
  style: 'custom' as const,
  customStyleUrl: 'https://example.com/styles/city-night.json',
};
```

or, if you need an inline JSON config:

```ts
const mapStyle = {
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

## Multi-Step Dialog Integration

The plugin adds **two** extended steps to the folder dialog via `PluginStepRegistry` (`src/ui/components/steps-provider.tsx`):

| step # | label        | form fields / interaction                                                                                                 | validation                                                                                  |
|--------|--------------|------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| 2      | Map Style    | preset cards (`streets`, `satellite`, `terrain`, `dark`, `light`) + “Custom” card with URL input                             | style must be selected; when `custom`, URL must be a valid absolute URL                    |
| 3      | Map Viewport | compact inputs for longitude/latitude/zoom/bearing + interactive MapLibre map (drag / wheel / double-click to adjust view) | longitude in [-180, 180], latitude in [-90, 90], zoom in [0, 24], bearing [-180, 180]; pitch is fixed at 0 internally |

Step gating is sequential (2 must validate before 3 is unlocked). Submit is enabled only when both steps pass validation (`BaseMapDialogExtension`).

There are no extra steps such as bounds, performance settings, or preview tabs at this stage.

## UI Components

Import from the UI entry point (`@hierarchidb/plugin-basemap/ui`):

| component        | description                                                                                          |
|------------------|------------------------------------------------------------------------------------------------------|
| `BaseMapPanel`   | high-level panel showing the configured map (style + viewport summary) with edit/refresh controls    |
| `BaseMapDisplay` | MapLibre-powered viewer that renders the persisted style + viewport                                  |
| `BaseMapPreview` | lightweight preview card (used inside dialogs or summaries)                                          |

The components only rely on `mapStyle` and `viewport`. There are no display-option toggles (traffic, 3D buildings, etc.) in the current implementation.

## Persistence & Worker Sync

- **Dexie database**: `BaseMapDatabase` (`basemap-db`) stores two tables: `baseMaps` (the entity) and `workingCopies`. The schema indexes only `id`, `nodeId`, `createdAt`, `updatedAt`.
- **Entity handler**: `BaseMapEntityHandler` extends `BaseEntityHandler` and performs normalization + validation; it mirrors every change into the peer store so worker consumers receive the same `mapStyle`/`viewport`.
- **Peer store**: `BasemapPeerData` keeps `{ schemaVersion: 1, presentation: { style, viewport } }` and nothing else, keeping the worker payload small and deterministic.

## Usage Example

```tsx
import '@hierarchidb/plugin-basemap/ui';
import { BaseMapPanel } from '@hierarchidb/plugin-basemap/ui';

export function BasemapNodeView({ nodeId }: { nodeId: string }) {
  return (
    <BaseMapPanel
      nodeId={nodeId as NodeId}
      height={420}
      onEdit={() => openDialog(nodeId)}
      onRefresh={() => console.info('Basemap refreshed')}
    />
  );
}
```

If you only need a preview thumbnail:

```tsx
import { BaseMapPreview } from '@hierarchidb/plugin-basemap/ui';

<BaseMapPreview mapStyle={entity.mapStyle} viewport={entity.viewport} height={240} />;
```

## Testing & Validation

This package ships with Vitest specs for the handler (`pnpm --filter @hierarchidb/basemap-plugin test`).  
Type-check scripts are not wired in this package; run workspace-level `pnpm typecheck` when integrating changes.

## Future Work

- Additional dialog steps (bounds, performance settings, preview) once the shared UI supports them.
- Optional display options (traffic, terrain) once the runtime proves a need for those flags.
- Runtime worker entity handlers; currently only peer-store mirroring exists.
- Reintroducing metadata documents (`BaseMapMetadata`) if/when external catalogues are required. For now, node data remains the single source of truth.
