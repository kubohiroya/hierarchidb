@hierarchidb/map-adapter
=====================

Map rendering adapter for MapLibre GL JS + deck.gl. Keeps rendering behind a facade/port so UIs can draw maps without hard dependencies in core packages.

## Directory layout
```
MapViewService.ts     Facade
ports.ts              MapAdapterPort contract
adapters/             MapLibreDeckAdapter (maplibre-gl + deck.gl)
TileSourceProvider.ts Tile source abstraction
index.ts              Public exports
```

## Key exports
- `MapViewService` — `init`, `setView`, `setStyle`, `setLayers`, `destroy`.
- Port: `MapAdapterPort`.
- Adapter: `MapLibreDeckAdapter` (constructors passed or lazily imported); env overrides `MAP_ADAPTER_MAPLIBRE_PKG` / `MAP_ADAPTER_DECK_PKG`.
- `TileSourceProvider` for template/function tile sources.

## Consumers / usage
- `@hierarchidb/ui-map` uses this to render layers; map data is supplied via `@hierarchidb/map-source`.
- Plugins (basemap/route/shape) pass GeoJSON/tile sources to `MapViewService`.

## Notes / roadmap
- No bundled maplibre/deck; supply constructors or allow lazy imports.
- Future: built-in layer factories, view-state sync helpers, offscreen export hooks.
