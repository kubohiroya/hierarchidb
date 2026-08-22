import type { MapboxOverlay as DeckMapboxOverlay } from '@deck.gl/mapbox';
import type { IControl } from 'maplibre-gl';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import type { MapLibreMapProps } from './MapLibreMap.js';
import type { DeckOverlayProps, MapWithDeckGLProps } from './MapWithDeckGL.js';

type DeckOverlayCtor = typeof DeckMapboxOverlay;

type DeckOverlayControl = IControl & {
  setProps: (props: DeckOverlayProps) => void;
};

type MapLibreComponent = React.ComponentType<MapLibreMapProps>;

type SafeStyle = Omit<React.CSSProperties, 'background'> & { background?: string };

let cachedOverlayCtor: DeckOverlayCtor | null = null;
let overlayCtorPromise: Promise<DeckOverlayCtor | null> | null = null;
let cachedMapLibreComponent: MapLibreComponent | null = null;
let mapLibreComponentPromise: Promise<MapLibreComponent> | null = null;

const normalizeStyle = (style?: React.CSSProperties): SafeStyle | undefined => {
  if (!style) return undefined;
  const { background, ...rest } = style;
  const safeBackground = typeof background === 'string' ? background : undefined;
  return safeBackground !== undefined ? { ...rest, background: safeBackground } : { ...rest };
};

const getCachedMapLibreComponent = (): MapLibreComponent | null => cachedMapLibreComponent;

const loadMapLibreComponent = async (): Promise<MapLibreComponent> => {
  if (cachedMapLibreComponent) return cachedMapLibreComponent;
  if (!mapLibreComponentPromise) {
    mapLibreComponentPromise = import('./MapLibreMap.js').then((mod) => {
      cachedMapLibreComponent = mod.MapLibreMap;
      return cachedMapLibreComponent;
    });
  }
  return mapLibreComponentPromise;
};

const loadDeckOverlayCtor = async (): Promise<DeckOverlayCtor | null> => {
  if (cachedOverlayCtor) return cachedOverlayCtor;
  if (!overlayCtorPromise) {
    overlayCtorPromise = import('@deck.gl/mapbox')
      .then((mod) => {
        const ctor = (mod?.MapboxOverlay ?? (mod as { default?: unknown }).default) as
          | DeckOverlayCtor
          | undefined;
        cachedOverlayCtor = typeof ctor === 'function' ? ctor : null;
        return cachedOverlayCtor;
      })
      .catch((error) => {
        if (typeof console !== 'undefined') {
          console.warn('[MapWithDeckGL] Failed to load @deck.gl/mapbox', error);
        }
        return null;
      });
  }
  return overlayCtorPromise;
};

export const useMapWithDeckGL = ({ deck, onLoad, ...mapProps }: MapWithDeckGLProps) => {
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const overlayRef = useRef<DeckOverlayControl | null>(null);
  const [overlayCtor, setOverlayCtor] = useState<DeckOverlayCtor | null>(cachedOverlayCtor);
  const [MapComponent, setMapComponent] = useState<MapLibreComponent | null>(
    getCachedMapLibreComponent
  );

  useEffect(() => {
    if (MapComponent) return;
    let mounted = true;
    void loadMapLibreComponent().then((component) => {
      if (mounted) setMapComponent(() => component);
    });
    return () => {
      mounted = false;
    };
  }, [MapComponent]);

  useEffect(() => {
    let mounted = true;
    if (!overlayCtor) {
      void loadDeckOverlayCtor().then((ctor) => {
        if (mounted && ctor) setOverlayCtor(() => ctor);
      });
    }
    return () => {
      mounted = false;
    };
  }, [overlayCtor]);

  const ensureOverlay = useCallback(
    (ctor: DeckOverlayCtor | null, mapInstance: MapLibreMapInstance | null) => {
      if (!ctor || !mapInstance || overlayRef.current) return;
      overlayRef.current = new ctor({
        interleaved: deck.interleaved ?? true,
        layers: deck.layers || [],
        getTooltip: deck.getTooltip,
        onClick: deck.onClick,
      }) as DeckOverlayControl;
      mapInstance.addControl(overlayRef.current);
    },
    [deck.interleaved, deck.layers, deck.getTooltip, deck.onClick]
  );

  const handleLoad = useCallback(
    (mapInstance: MapLibreMapInstance) => {
      mapRef.current = mapInstance;
      if (!overlayCtor) {
        void loadDeckOverlayCtor().then((ctor) => {
          if (ctor && mapRef.current === mapInstance) {
            setOverlayCtor(() => ctor);
            ensureOverlay(ctor, mapInstance);
          }
        });
      } else {
        ensureOverlay(overlayCtor, mapInstance);
      }
      onLoad?.(mapInstance);
    },
    [ensureOverlay, onLoad, overlayCtor]
  );

  useEffect(() => {
    ensureOverlay(overlayCtor, mapRef.current);
  }, [ensureOverlay, overlayCtor]);

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.setProps({
        layers: deck.layers || [],
        getTooltip: deck.getTooltip,
        onClick: deck.onClick,
      });
    }
  }, [deck.layers, deck.getTooltip, deck.onClick]);

  useEffect(
    () => () => {
      if (overlayRef.current) {
        overlayRef.current.setProps({ layers: [] });
        overlayRef.current = null;
      }
    },
    []
  );

  const fallbackStyle: React.CSSProperties = {
    width: (mapProps.width as string | number | undefined) ?? '100%',
    height: (mapProps.height as string | number | undefined) ?? '100%',
    position: 'relative',
    ...(normalizeStyle(mapProps.style) ?? {}),
  };

  return {
    MapComponent,
    handleLoad,
    fallbackStyle,
  };
};
