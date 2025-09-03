// Lightweight adapter to bind MapLibre GL JS and deck.gl together on demand.
// Heavy libs are peerDependencies; pass constructors at runtime to avoid bundling.

import type { MapAdapterPort } from '../ports';
import type { DeckLayerSpec, MapStyleSpec, ViewState } from '../types';

type MapLibreCtor = any; // typeof import('maplibre-gl')
type DeckCtor = any;     // typeof import('@deck.gl/core').Deck

export interface MapLibreDeckAdapterOptions {
  maplibregl: MapLibreCtor;
  Deck: DeckCtor;
  mapOptions?: Record<string, any>;
}

export class MapLibreDeckAdapter implements MapAdapterPort {
  private map?: any;
  private deck?: any;
  constructor(private opts: MapLibreDeckAdapterOptions) {}

  init(container: HTMLElement, initialView: ViewState, style?: MapStyleSpec): void {
    const { maplibregl, Deck, mapOptions } = this.opts;
    this.map = new maplibregl.Map({
      container,
      style: style?.styleUrl || style?.styleObject || 'https://demotiles.maplibre.org/style.json',
      center: [initialView.longitude, initialView.latitude],
      zoom: initialView.zoom,
      bearing: initialView.bearing ?? 0,
      pitch: initialView.pitch ?? 0,
      ...mapOptions,
    });
    // @ts-ignore deck.gl overlay (using maplibre integration pattern)
    this.deck = new Deck({
      parent: container,
      initialViewState: { longitude: initialView.longitude, latitude: initialView.latitude, zoom: initialView.zoom, bearing: initialView.bearing ?? 0, pitch: initialView.pitch ?? 0 },
      controller: true,
      layers: [],
    });
  }
  destroy(): void { this.deck?.finalize(); this.map?.remove(); this.deck = undefined; this.map = undefined; }
  setView(view: Partial<ViewState>): void {
    if (!this.map) return;
    if (view.zoom !== undefined) this.map.setZoom(view.zoom);
    if (view.longitude !== undefined && view.latitude !== undefined) this.map.setCenter([view.longitude, view.latitude]);
    if (view.bearing !== undefined) this.map.setBearing(view.bearing);
    if (view.pitch !== undefined) this.map.setPitch(view.pitch);
  }
  setStyle(style: MapStyleSpec): void { if (!this.map) return; this.map.setStyle(style.styleUrl || style.styleObject); }
  addDeckLayers(layers: DeckLayerSpec[]): void { this.updateDeckLayers([...(this.deck?.props.layers || []), ...toLayers(layers)]); }
  updateDeckLayers(layers: DeckLayerSpec[]): void { if (!this.deck) return; this.deck.setProps({ layers: toLayers(layers) }); }
  removeDeckLayers(ids: string[]): void {
    if (!this.deck) return; const rest = (this.deck.props.layers || []).filter((l: any) => !ids.includes(l.id));
    this.deck.setProps({ layers: rest });
  }
}

function toLayers(specs: DeckLayerSpec[]): any[] {
  // Caller should pass prebound layer constructors in specs.props if desired.
  // Avoid duplicating properties like 'id' by spreading only once.
  return specs.map((s) => ({ ...s }));
}
