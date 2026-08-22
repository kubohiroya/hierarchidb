// Lightweight adapter to bind MapLibre GL JS and deck.gl together on demand.
// Heavy libs are peerDependencies; pass constructors at runtime-worker to avoid bundling.

import { readRuntimeEnvValue } from '@hierarchidb/util';
import type { Deck, LayersList } from 'deck.gl';
import type * as MapLibreNS from 'maplibre-gl';
import type { MapAdapterPort } from '~/portTypes';
import type { DeckLayerSpec, MapStyleSpec, ViewState } from '~/types';

type MapLibreCtor = typeof import('maplibre-gl');
type DeckCtor = typeof import('deck.gl').Deck;

interface EnvOverrides {
  MAP_ADAPTER_MAPLIBRE_PKG?: string;
  MAP_ADAPTER_DECK_PKG?: string;
}

interface ViteEnvOverrides {
  VITE_MAP_ADAPTER_MAPLIBRE_PKG?: string;
  VITE_MAP_ADAPTER_DECK_PKG?: string;
}

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

  async init(
    container: HTMLDivElement,
    initialView: ViewState,
    style?: MapStyleSpec
  ): Promise<void> {
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
    if (!this.deck) return;
    const existing = (this.deck.props.layers ?? []) as LayersList;
    this.setDeckLayersRaw([...existing, ...toLayers(layers)]);
  }

  updateDeckLayers(layers: DeckLayerSpec[]): void {
    this.setDeckLayersRaw(toLayers(layers));
  }

  removeDeckLayers(ids: string[]): void {
    if (!this.deck) return;
    const current = (this.deck.props.layers ?? []) as LayersList;
    const filtered = current.filter((layer) => {
      if (!layer) return true;
      return !ids.includes(String((layer as { id?: unknown }).id));
    }) as LayersList;
    this.setDeckLayersRaw(filtered);
  }

  private setDeckLayersRaw(layers: LayersList): void {
    if (!this.deck) return;
    this.deck.setProps({ layers });
  }

  private async ensureLibs(): Promise<{ maplibregl: MapLibreCtor; Deck: DeckCtor }> {
    if (this._maplibregl && this._Deck) return { maplibregl: this._maplibregl, Deck: this._Deck };
    // Prefer injected constructors
    if (this.opts.maplibregl && this.opts.Deck) {
      this._maplibregl = this.opts.maplibregl;
      this._Deck = this.opts.Deck;
      return { maplibregl: this._maplibregl, Deck: this._Deck };
    }
    // Lazy load at runtime-worker. Allow overrides via env/global or options.
    const globalOverrides = globalThis as EnvOverrides;
    const viteEnv = (
      typeof import.meta !== 'undefined'
        ? ((import.meta as { env?: ViteEnvOverrides }).env ?? {})
        : {}
    ) as ViteEnvOverrides;
    const envOverrides: EnvOverrides = {
      MAP_ADAPTER_MAPLIBRE_PKG: readRuntimeEnvValue('MAP_ADAPTER_MAPLIBRE_PKG', { prefixes: [''] }),
      MAP_ADAPTER_DECK_PKG: readRuntimeEnvValue('MAP_ADAPTER_DECK_PKG', { prefixes: [''] }),
    };
    const maplibreName =
      this.opts.maplibrePackageName ||
      viteEnv.VITE_MAP_ADAPTER_MAPLIBRE_PKG ||
      globalOverrides.MAP_ADAPTER_MAPLIBRE_PKG ||
      envOverrides.MAP_ADAPTER_MAPLIBRE_PKG ||
      'maplibre-gl';
    const deckName =
      this.opts.deckPackageName ||
      viteEnv.VITE_MAP_ADAPTER_DECK_PKG ||
      globalOverrides.MAP_ADAPTER_DECK_PKG ||
      envOverrides.MAP_ADAPTER_DECK_PKG ||
      'deck.gl';
    // Use vite-ignore + computed names to avoid bundler pre-bundling
    const modMap = await import(/* @vite-ignore */ maplibreName);
    const modDeck = await import(/* @vite-ignore */ deckName);
    const maplibregl = resolveMapLibreCtor(modMap);
    const Deck = resolveDeckCtor(modDeck);
    if (!maplibregl?.Map || !Deck)
      throw new Error('Failed to load maplibre-gl/deck.gl at runtime-worker');
    this._maplibregl = maplibregl;
    this._Deck = Deck;
    return { maplibregl, Deck };
  }
}

function toLayers(specs: DeckLayerSpec[]): LayersList {
  return specs;
}

function resolveMapLibreCtor(mod: unknown): MapLibreCtor {
  const candidate = mod as (Partial<MapLibreCtor> & { default?: MapLibreCtor }) | undefined;
  if (candidate && candidate.Map) {
    return candidate as MapLibreCtor;
  }
  if (candidate && candidate.default) {
    return candidate.default;
  }
  throw new Error('maplibre-gl module missing Map export');
}

function resolveDeckCtor(mod: unknown): DeckCtor {
  const candidate = mod as { Deck?: DeckCtor; default?: DeckCtor } | undefined;
  if (candidate?.Deck) {
    return candidate.Deck;
  }
  if (candidate?.default) {
    return candidate.default;
  }
  throw new Error('deck.gl module missing Deck export');
}
