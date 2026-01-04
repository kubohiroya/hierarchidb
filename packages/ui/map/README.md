# @hierarchidb/ui-map

MapLibre GL-based map components for HierarchiDB. Wraps maplibre-gl and deck.gl overlays with typed props and feature identification helpers.

## Directory layout
```
components/
  MapLibreMap            Core map component (MapLibre GL via @vis.gl/react-maplibre)
  MapWithDeckGL          MapLibre + deck.gl overlay (MapboxOverlay)
  MapWithVectorTiles     Vector tile wiring helper
  VectorTileLayer        Convenience layer helper
lib/feature-identification.ts  identifyFeatureOnClick helpers (queryRenderedFeatures)
types/unified-map-props.ts     Shared prop/handler types
index.ts                 Public exports
```

## Key exports
- `MapLibreMap` — accepts `initialViewState`, `mapStyleUrl`/`mapStyleObject`, `controls`, `identifyFeatureOnClick`, `onViewStateChange/onClick/onLoad`, and children (layers/controls).
- `MapWithDeckGL` — mounts a deck.gl `MapboxOverlay` over MapLibre; pass `deckLayers` and optional constructors.
- `MapWithVectorTiles` / `VectorTileLayer` — helpers to add vector tile sources/layers.
- `SimpleMapDisplay` — minimal map display wrapper with shared defaults.
- `FullMapDisplay` — full-featured wrapper for resource/vector layers and style overrides.
- Types: `BaseMapProps`, `MapLibreMapProps`, identify handlers/options.
- Preview hooks: `useVectorTilePreviewMetadata`, `useVectorTilePreviewSearch`, `useVectorTilePreviewSelection`, `useVectorTilePreviewMapLayers`.

## Feature identification
- `identifyFeatureOnClick` uses `queryRenderedFeatures` with layer filters/radius and optional `getFeatureId`; results are deduped and passed to `onClick`.
- Deck.gl picking can be combined in `MapWithDeckGL` via `pickable` layers; merge with MapLibre results as needed.

## Consumers / usage
- Used by basemap/route/shape plugins and app dialogs to render map previews and interactive layers.
- Map data typically comes from `@hierarchidb/map-source`; rendering adapter from `@hierarchidb/map-adapter`.

## Notes
- maplibre-gl/deck.gl are external peers; this package centralizes the dependency and TS config quirks to avoid leaking to other packages.
