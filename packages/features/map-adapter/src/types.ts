// Note: Keep this file decoupled from map-source to avoid workspace stage order issues.

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

import type { Layer } from 'deck.gl';

export type DeckLayerSpec = Layer;

export interface MapViewConfig {
  container: HTMLElement;
  initialViewState: ViewState;
  mapStyle?: MapStyleSpec;
}
