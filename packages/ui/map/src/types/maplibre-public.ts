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
}

export interface MapLibreStyle {
  layers: MapLibreLayer[];
  sources: Record<string, unknown>;
}

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
  zoomIn(): void;
  zoomOut(): void;
  setPitch(pitch: number, options?: Record<string, unknown>): void;
  setBearing(bearing: number, options?: Record<string, unknown>): void;
  getZoom(): number;
  getCenter(): { lng: number; lat: number };
  getPitch(): number;
  getBearing(): number;
  flyTo(options: Record<string, unknown>): void;
  setStyle(style: string | MapLibreStyle): void;
  fitBounds(bounds: [[number, number], [number, number]], options?: Record<string, unknown>): void;
}

// Minimal filter type to avoid leaking upstream types
export type MapLibreFilter = unknown;
