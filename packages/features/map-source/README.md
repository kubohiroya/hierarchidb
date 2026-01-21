@hierarchidb/map-source
=======================

Shared map data source facade for GeoJSON retrieval from Dexie/IndexedDB. Provides BBox/tile queries behind a port so shape/location/route plugins can share one API.

## Directory layout
```
MapSourceService.ts  Facade
ports.ts             MapSourcePort contract
adapters/            FeatureCollectionGridIndex and other helpers
index.ts             Public exports + FeatureDefinition
```

## Key exports
- `MapSourceService`
  - `getFeaturesInBBox(bbox, zoom?, filters?)`
  - `getFeaturesInTile({ z, x, y }, filters?)`
- `getMetadata()`
- Port: `MapSourcePort` (pluggable backends).
- Adapter: `FeatureCollectionGridIndex` (in-memory spatial index helper).
- Capability: `FeatureDefinition.manifest` (`provides: ['map-source']`).

## Consumers / usage
- Used by `@hierarchidb/map-adapter` / `@hierarchidb/ui-map` to render GeoJSON.
- Plugins (shape, route, basemap) expose their data via a `MapSourcePort` implementation.

## Notes / roadmap
- For large datasets, prefer indexed/LOD-aware ports.
- Coordinates assume GeoJSON EPSG:4326; tile BBox uses simple WebMercator math.
- DexieShapePort has been removed; implement a MapSourcePort backed by current shape stores.
