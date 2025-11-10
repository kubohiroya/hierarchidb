// Minimal, stable public typings that describe only what we use from MapLibre.
// This avoids leaking upstream d.ts complexities to downstream packages.

export type MapLibreLayerType =
  | 'fill'
  | 'line'
  | 'circle'
  | 'symbol'
  | 'raster'
  | 'background'
  | 'fill-extrusion'
  | 'heatmap'
  | 'hillshade';

export interface MapLibreLayer {
  id: string;
  type: MapLibreLayerType;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
}

export interface MapLibreStyle {
  layers: MapLibreLayer[];
  sources: Record<string, unknown>;
}

export type MapLibreFeatureIdentifier = string | number;

export interface MapLibreGeoJSONFeature {
  id?: MapLibreFeatureIdentifier;
  properties?: Record<string, unknown> | null;
  layer?: { id?: string };
}

export interface MapLibrePoint {
  x: number;
  y: number;
}

export type MapLibreQueryGeometry =
  | MapLibrePoint
  | [number, number]
  | [[number, number], [number, number]];

export interface MapLibreMapInstance {
  getStyle(): MapLibreStyle;

  getLayer(id: string): MapLibreLayer | undefined;

  setLayoutProperty(layerId: string, name: string, value: unknown): void;

  getTerrain(): unknown | null;

  setTerrain(options: { source: string; exaggeration?: number } | null): void;

  once(event: 'styledata', cb: () => void): void;

  on(event: string, cb: (...args: unknown[]) => void): void;

  getContainer(): HTMLElement;

  addLayer(layer: Record<string, unknown>, beforeId?: string): void;

  getSource(id: string): unknown;

  addSource(id: string, source: Record<string, unknown>): void;

  removeSource(id: string): void;

  removeLayer(id: string): void;

  addControl(control: unknown, position?: string): void;

  queryRenderedFeatures(geometry?: MapLibreQueryGeometry, parameters?: { layers?: string[]; filter?: MapLibreFilter }): MapLibreGeoJSONFeature[];

  // Commonly used convenience methods (subset of MapLibre Map API)
  zoomIn(): void;
  zoomOut(): void;
  flyTo(opts: { center?: [number, number]; zoom?: number; bearing?: number; pitch?: number; speed?: number }): void;
  setPitch(pitch: number): void;
  setStyle(style: string | MapLibreStyle): void;
  fitBounds(bounds: [[number, number], [number, number]], options?: { padding?: number }): void;
}

export interface MapLibreMapMouseEvent {
  target: MapLibreMapInstance;
  point: MapLibrePoint;
  lngLat: { lng: number; lat: number };
  features?: MapLibreGeoJSONFeature[];
  originalEvent?: MouseEvent;
}

// Minimal filter type to avoid leaking upstream types
export type MapLibreFilter = unknown;
