@hierarchidb/map-adapter
=====================

Map rendering adapter with MapLibre GL JS + deck.gl integration as an optional, reusable capability. Keeps rendering concerns behind a Facade + Adapter so UIs can display maps without hard dependencies in core packages.

Design intent
-------------
- Decouple data (map-source) from rendering (map-view).
- Avoid bundling heavy render libs unless needed: use peerDependencies and pass constructors at runtime.
- Provide a small, stable API: initialize map, set view/style, update deck layers.

Architecture
------------
- Facade: `MapViewService`
  - `init({ container, initialViewState, mapStyle })`
  - `setView(view)`, `setStyle(style)`, `setLayers(deckLayers)`, `destroy()`
- Port: `MapAdapterPort` (render backend)
  - `init/destroy/setView/setStyle/addDeckLayers/updateDeckLayers/removeDeckLayers`
- Adapter: `MapLibreDeckAdapter`
  - Requires `maplibre-gl` and `deck.gl` (peerDependencies)
  - Constructors can be passed via options or lazily loaded at `init()`
  - Strongly typed via `import type` (no `any` usage)

Usage
-----
```ts
import { MapViewService, MapLibreDeckAdapter } from '@hierarchidb/map-adapter';
import * as maplibregl from 'maplibre-gl';
import { Deck } from 'deck.gl';

const adapter = new MapLibreDeckAdapter({ maplibregl, Deck });
const map = new MapViewService(adapter);
await map.init({ container: el, initialViewState: { longitude: 139.76, latitude: 35.68, zoom: 9 } });
await map.setLayers([{ id: 'geojson', type: 'GeoJsonLayer', props: { data: featureCollection } }]);
```

Notes
-----
- Does not hard-bundle maplibre-gl/deck.gl. You can pass constructors, or omit them and let the adapter lazily import packages at `init()`.
  - Overrides: `MAP_ADAPTER_MAPLIBRE_PKG` / `MAP_ADAPTER_DECK_PKG` (env/global) or `maplibrePackageName` / `deckPackageName` (options). Defaults are `maplibre-gl` and `deck.gl`.
 - Tile sources: use `TileSourceProvider` to decouple UI rendering from tile generation (worker/plugins).
   - `{ kind: 'template', template: 'https://.../{z}/{x}/{y}.pbf' }`
   - `{ kind: 'function', getTile: (z,x,y) => Promise<ArrayBuffer> }`
- Data retrieval (Dexie等)は @hierarchidb/map-source から取得して渡してください。

Roadmap
-------
- Adapter for custom controllers and sync between MapLibre/deck view states
- Built-in layer factories for common patterns (heatmap, point cluster)
- Offscreen rendering hooks for export
