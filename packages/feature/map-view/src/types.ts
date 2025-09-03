import type { BBox } from '@hierarchidb/map-source';

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface MapStyleSpec {
  styleUrl?: string; // maplibre style json url
  styleObject?: any; // inline style json
}

export type DeckLayerSpec = {
  id: string;
  type: string; // e.g., 'GeoJsonLayer', 'ScatterplotLayer'
  props: Record<string, any>;
};

export interface MapViewConfig {
  container: HTMLElement;
  initialViewState: ViewState;
  mapStyle?: MapStyleSpec;
}

