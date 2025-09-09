import type { DeckLayerSpec, MapStyleSpec, ViewState } from './types';

export interface MapAdapterPort {
  init(container: HTMLElement, initialView: ViewState, style?: MapStyleSpec): Promise<void> | void;

  destroy(): Promise<void> | void;

  setView(view: Partial<ViewState>): Promise<void> | void;

  setStyle(style: MapStyleSpec): Promise<void> | void;

  addDeckLayers(layers: DeckLayerSpec[]): Promise<void> | void;

  updateDeckLayers(layers: DeckLayerSpec[]): Promise<void> | void;

  removeDeckLayers(layerIds: string[]): Promise<void> | void;
}

