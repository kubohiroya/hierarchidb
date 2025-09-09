declare module '@hierarchidb/ui-map' {
  import type React from 'react';

  export interface MapViewState {
    longitude: number;
    latitude: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
  }

  export interface MapLibreStyle {
    layers?: Array<{ id: string; type?: string; layout?: Record<string, unknown> }>;
    sources?: Record<string, unknown>;

    [k: string]: unknown;
  }

  export interface MapLibreMapInstance {
    getStyle(): MapLibreStyle;

    addLayer(layer: Record<string, unknown>, beforeId?: string): void;

    getLayer(id: string): any;

    removeLayer(id: string): void;

    getSource(id: string): any;

    addSource(id: string, source: Record<string, unknown>): void;

    removeSource(id: string): void;

    setLayoutProperty(layerId: string, name: string, value: unknown): void;

    fitBounds(bounds: [[number, number], [number, number]], options?: { padding?: number }): void;
  }

  export interface VectorTileLayerConfig {
    layerId?: string;
    sourceId?: string;
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
    filter?: any[];
    minzoom?: number;
    maxzoom?: number;
    layerType?: 'fill' | 'line' | 'circle' | 'symbol' | 'raster' | 'background';
    sourceLayer?: string;
    visible?: boolean;
  }

  export const MapWithVectorTiles: React.FC<{
    initialViewState: MapViewState;
    mapStyle?: string | MapLibreStyle;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
    dbName?: string;
    nodeId?: string;
    tileDataProvider?: (z: number, x: number, y: number, nodeId?: string) => Promise<ArrayBuffer | null>;
    layerConfig?: VectorTileLayerConfig;
    onLoad?: (m: MapLibreMapInstance) => void;
  }>;
}
