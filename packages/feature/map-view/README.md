@hierarchidb/map-view
=====================

Map rendering feature with MapLibre GL JS + deck.gl integration as an optional, reusable capability. Keeps rendering concerns behind a Facade + Adapter so UIs can display maps without hard dependencies in core packages.

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
  - Requires `maplibre-gl` and `deck.gl` constructors at runtime
  - Manages a MapLibre map and a deck.gl overlay

Usage
-----
```ts
import { MapViewService, MapLibreDeckAdapter } from '@hierarchidb/map-view';
import * as maplibregl from 'maplibre-gl';
import { Deck } from 'deck.gl';

const adapter = new MapLibreDeckAdapter({ maplibregl, Deck });
const map = new MapViewService(adapter);
await map.init({ container: el, initialViewState: { longitude: 139.76, latitude: 35.68, zoom: 9 } });
await map.setLayers([{ id: 'geojson', type: 'GeoJsonLayer', props: { data: featureCollection } }]);
```

Notes
-----
- @hierarchidb/map-view does not import maplibre-gl/deck.gl directly; add them to your app and pass in.
- Data retrieval (Dexie等)は @hierarchidb/map-source から取得して渡してください。

Roadmap
-------
- Adapter for custom controllers and sync between MapLibre/deck view states
- Built-in layer factories for common patterns (heatmap, point cluster)
- Offscreen rendering hooks for export

