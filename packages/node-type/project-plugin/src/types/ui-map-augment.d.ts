declare module '@hierarchidb/ui-map' {
  import type React from 'react';

  export interface MapLibreStyle {
    layers: Array<{ id: string; type?: string; layout?: Record<string, unknown> }>;
    sources: Record<string, unknown>;
  }
  export interface MapLibreLayer { id: string; type?: string; layout?: Record<string, unknown> }

  export interface MapViewState {
    longitude: number;
    latitude: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
  }

  // Augment instance to include methods used in project-plugin
  export interface MapLibreMapInstance {
    getStyle(): MapLibreStyle;
    addControl(control: unknown, position?: string): void;
    setLayoutProperty(layerId: string, name: string, value: unknown): void;
    getContainer(): HTMLElement;
    getLayer(id: string): MapLibreLayer | undefined;
    addLayer(layer: Record<string, unknown>, beforeId?: string): void;
    getSource(id: string): unknown;
    addSource(id: string, source: Record<string, unknown>): void;
    removeSource(id: string): void;
    removeLayer(id: string): void;
    // Methods used in ProjectMapView; mapped to runtime maplibre instance
    zoomIn(): void;
    zoomOut(): void;
    flyTo(opts: { center?: [number, number]; zoom?: number; bearing?: number; pitch?: number; speed?: number }): void;
    setPitch(pitch: number): void;
    setStyle(style: string | MapLibreStyle): void;
  }

  export const MapLibreMap: React.FC<{
    initialViewState: MapViewState;
    mapStyle?: string | MapLibreStyle;
    onLoad?: (m: MapLibreMapInstance) => void;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
  }>;

  export const MapWithDeckGL: React.FC<{
    initialViewState: MapViewState;
    mapStyle?: string | MapLibreStyle;
    onLoad?: (m: MapLibreMapInstance) => void;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
  }>;
}
