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

// Tile source abstraction to decouple rendering from tile generation.
export type TileSourceProvider =
  | {
      kind: 'template';
      template: string; // e.g. 'https://tiles.example.com/{z}/{x}/{y}.pbf'
    }
  | {
    kind: 'function';
    getTile(z: number, x: number, y: number): Promise<ArrayBuffer>;
  };

