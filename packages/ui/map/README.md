# @hierarchidb/ui-map

Shared map components for HierarchiDB with MapLibre GL support.

## Features

- **MapLibre GL Integration**: Full MapLibre GL map rendering
- **Vector Tile Support**: Custom vector tile layers with Dexie protocol support
- **TypeScript**: Full TypeScript support with comprehensive type definitions
- **React Components**: Easy-to-use React components for map integration
- **Customizable**: Flexible configuration for different use cases

## Installation

```bash
npm install @hierarchidb/ui-map
```

## Components

### MapLibreMap

Basic MapLibre GL map component.

```tsx
import { MapLibreMap } from '@hierarchidb/ui-map';

<MapLibreMap
  initialViewState={{
    longitude: 139.7,
    latitude: 35.7,
    zoom: 10
  }}
  mapStyle="https://demotiles.maplibre.org/style.json"
  onLoad={(map) => console.log('Map loaded')}
/>
```

### VectorTileLayer

Vector tile layer component for adding custom data layers.

```tsx
import { VectorTileLayer } from '@hierarchidb/ui-map';

<VectorTileLayer
  map={mapInstance}
  layerId="my-layer"
  sourceId="my-source"
  tiles={['https://example.com/tiles/{z}/{x}/{y}.pbf']}
  paint={{
    'fill-color': '#0080ff',
    'fill-opacity': 0.7
  }}
/>
```

### MapWithVectorTiles

Integrated map component with vector tile support.

```tsx
import { MapWithVectorTiles } from '@hierarchidb/ui-map';

<MapWithVectorTiles
  dbName="mydb"
  nodeId="node123"
  initialViewState={{
    longitude: 139.7,
    latitude: 35.7,
    zoom: 10
  }}
  layerOptions={{
    paint: {
      'fill-color': '#ff8000',
      'fill-opacity': 0.8
    }
  }}
  tileDataProvider={async (z, x, y, nodeId) => {
    // Return ArrayBuffer with tile data
    return await fetchTileData(z, x, y, nodeId);
  }}
/>
```

## API Reference

### MapViewState

```typescript
interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}
```

### LayerOptions

```typescript
interface LayerOptions {
  layerId?: string;
  sourceId?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: FilterSpecification;
  minzoom?: number;
  maxzoom?: number;
  layerType?: 'fill' | 'line' | 'circle' | 'symbol' | 'raster' | 'background';
  sourceLayer?: string;
}
```

## Custom Protocols

The package supports custom `dexie://` protocol for loading vector tiles from Dexie databases:

```
dexie://dbname/nodeid/{z}/{x}/{y}
```

## Dependencies

- `maplibre-gl`: MapLibre GL JS for map rendering
- `@vis.gl/react-maplibre`: React wrapper for MapLibre GL
- `react`: React 18+

## License

MIT