import type { MapAdapterPort } from './portTypes.js';
import type { DeckLayerSpec, MapStyleSpec, MapViewConfig, ViewState } from './types.js';

export class MapViewService {
  private adapter: MapAdapterPort;
  private isInit = false;

  constructor(adapter: MapAdapterPort) {
    this.adapter = adapter;
  }

  async init(cfg: MapViewConfig): Promise<void> {
    await this.adapter.init(cfg.container, cfg.initialViewState, cfg.mapStyle);
    this.isInit = true;
  }

  async destroy(): Promise<void> {
    if (this.isInit) await this.adapter.destroy();
    this.isInit = false;
  }

  async setView(view: Partial<ViewState>): Promise<void> {
    await this.adapter.setView(view);
  }

  async setStyle(style: MapStyleSpec): Promise<void> {
    await this.adapter.setStyle(style);
  }

  async setLayers(layers: DeckLayerSpec[]): Promise<void> {
    await this.adapter.updateDeckLayers(layers);
  }
}
