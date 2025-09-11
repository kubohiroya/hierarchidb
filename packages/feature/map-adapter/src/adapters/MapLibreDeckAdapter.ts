// Lightweight adapter to bind MapLibre GL JS and deck.gl together on demand.
// Heavy libs are peerDependencies; pass constructors at runtime to avoid bundling.

import type { MapAdapterPort } from '../ports';
import type { DeckLayerSpec, MapStyleSpec, ViewState } from '../types';
import type * as MapLibreNS from 'maplibre-gl';
import type { Deck, LayersList } from 'deck.gl';

type MapLibreCtor = typeof import('maplibre-gl');
type DeckCtor = typeof import('deck.gl').Deck;

export interface MapLibreDeckAdapterOptions {
  maplibregl?: MapLibreCtor;
  Deck?: DeckCtor;
  mapOptions?: Partial<MapLibreNS.MapOptions>;
  // Optional package name overrides for lazy load
  maplibrePackageName?: string; // default: 'maplibre-gl'
  deckPackageName?: string; // default: 'deck.gl'
}

export class MapLibreDeckAdapter implements MapAdapterPort {
  private map?: MapLibreNS.Map;
  private deck?: Deck;
  private _maplibregl?: MapLibreCtor;
  private _Deck?: DeckCtor;

  constructor(private opts: MapLibreDeckAdapterOptions) {}

  async init(container: HTMLDivElement, initialView: ViewState, style?: MapStyleSpec): Promise<void> {
    const { mapOptions } = this.opts;
    const { maplibregl, Deck } = await this.ensureLibs();
    this.map = new maplibregl.Map({
      container,
      style: style?.styleUrl || style?.styleObject || 'https://demotiles.maplibre.org/style.json',
      center: [initialView.longitude, initialView.latitude],
      zoom: initialView.zoom,
      bearing: initialView.bearing ?? 0,
      pitch: initialView.pitch ?? 0,
      ...(mapOptions as MapLibreNS.MapOptions | undefined),
    });

    // deck.gl overlay (MapLibre integration pattern)
    this.deck = new Deck({
      parent: container,
      initialViewState: {
        longitude: initialView.longitude,
        latitude: initialView.latitude,
        zoom: initialView.zoom,
        bearing: initialView.bearing ?? 0,
        pitch: initialView.pitch ?? 0,
      },
      controller: true,
      layers: [],
    }) as Deck;
  }

  destroy(): void {
    this.deck?.finalize();
    this.map?.remove();
    this.deck = undefined;
    this.map = undefined;
  }

  setView(view: Partial<ViewState>): void {
    if (!this.map) return;
    if (view.zoom !== undefined) this.map.setZoom(view.zoom);
    if (view.longitude !== undefined && view.latitude !== undefined)
      this.map.setCenter([view.longitude, view.latitude]);
    if (view.bearing !== undefined) this.map.setBearing(view.bearing);
    if (view.pitch !== undefined) this.map.setPitch(view.pitch);
  }

  setStyle(style: MapStyleSpec): void {
    if (!this.map) return;
    this.map.setStyle(style.styleUrl || style.styleObject);
  }

  addDeckLayers(layers: DeckLayerSpec[]): void {
    const merged: unknown[] = [
      ...((this.deck?.props.layers as unknown[]) || []),
      ...toLayers(layers),
    ];
    this.setDeckLayersRaw(merged);
  }

  updateDeckLayers(layers: DeckLayerSpec[]): void {
    this.setDeckLayersRaw(toLayers(layers));
  }

  removeDeckLayers(ids: string[]): void {
    if (!this.deck) return;
    const current: any[] = ([] as any[]).concat((this.deck.props.layers as unknown) || []);
    const rest = current.filter((l) => !ids.includes(String(l?.id)));
    this.setDeckLayersRaw(rest);
  }

  private setDeckLayersRaw(layers: unknown[]): void {
    if (!this.deck) return;
    this.deck.setProps({ layers: layers as unknown as LayersList });
  }

  private async ensureLibs(): Promise<{ maplibregl: MapLibreCtor; Deck: DeckCtor }> {
    if (this._maplibregl && this._Deck) return { maplibregl: this._maplibregl, Deck: this._Deck };
    // Prefer injected constructors
    if (this.opts.maplibregl && this.opts.Deck) {
      this._maplibregl = this.opts.maplibregl;
      this._Deck = this.opts.Deck;
      return { maplibregl: this._maplibregl, Deck: this._Deck };
    }
    // Lazy load at runtime. Allow overrides via env/global or options.
    const g: any = (globalThis as any);
    const viteEnv: any = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined) || {};
    const nodeEnv: any = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
    const maplibreName =
      this.opts.maplibrePackageName ||
      viteEnv?.VITE_MAP_ADAPTER_MAPLIBRE_PKG ||
      g?.MAP_ADAPTER_MAPLIBRE_PKG ||
      nodeEnv?.MAP_ADAPTER_MAPLIBRE_PKG ||
      'maplibre-gl';
    const deckName =
      this.opts.deckPackageName ||
      viteEnv?.VITE_MAP_ADAPTER_DECK_PKG ||
      g?.MAP_ADAPTER_DECK_PKG ||
      nodeEnv?.MAP_ADAPTER_DECK_PKG ||
      'deck.gl';
    // Use vite-ignore + computed names to avoid bundler pre-bundling
    const modMap = (await import(/* @vite-ignore */ maplibreName)) as any;
    const modDeck = (await import(/* @vite-ignore */ deckName)) as any;
    const maplibregl = (modMap?.default ?? modMap) as MapLibreCtor;
    const Deck = (modDeck?.Deck ?? modDeck?.default ?? modDeck) as DeckCtor;
    if (!maplibregl?.Map || !Deck) throw new Error('Failed to load maplibre-gl/deck.gl at runtime');
    this._maplibregl = maplibregl;
    this._Deck = Deck;
    return { maplibregl, Deck };
  }
}

function toLayers(specs: DeckLayerSpec[]): unknown[] {
  // Caller should pass prebound layer constructors in specs.props if desired.
  // Avoid duplicating properties like 'id' by spreading only once.
  return specs.map((s) => ({ ...s }));
}
