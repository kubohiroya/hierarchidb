/**
 * @file MapWithDeckGL.tsx
 * @description MapLibre + Deck.gl overlay integration using MapboxOverlay.
 * The Deck.gl dependency stays optional via peerDependencies.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IControl } from 'maplibre-gl';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import type { MapboxOverlay as DeckMapboxOverlay } from '@deck.gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';
import type { MapLibreMapProps } from './MapLibreMap.js';

export interface DeckOverlayProps {
  layers: Layer[];
  interleaved?: boolean;
  getTooltip?: (info: PickingInfo) => DeckTooltip;
  onClick?: (info: PickingInfo) => void;
}

export type MapWithDeckGLProps = MapLibreMapProps & {
  deck: DeckOverlayProps;
};

type DeckOverlayCtor = typeof DeckMapboxOverlay;

type DeckOverlayControl = IControl & {
  setProps: (props: DeckOverlayProps) => void;
};

type DeckTooltip = null | string | {
  text?: string;
  html?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
};

let cachedOverlayCtor: DeckOverlayCtor | null = null;
let overlayCtorPromise: Promise<DeckOverlayCtor | null> | null = null;

type MapLibreComponent = React.ComponentType<MapLibreMapProps>;

let cachedMapLibreComponent: MapLibreComponent | null = null;
let mapLibreComponentPromise: Promise<MapLibreComponent> | null = null;

type SafeStyle = Omit<React.CSSProperties, 'background'> & { background?: string };

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
        const ctor = (mod?.MapboxOverlay ?? (mod as { default?: unknown }).default) as DeckOverlayCtor | undefined;
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

export const MapWithDeckGL: React.FC<MapWithDeckGLProps> = ({ deck, onLoad, ...mapProps }) => {
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const overlayRef = useRef<DeckOverlayControl | null>(null);
  const [overlayCtor, setOverlayCtor] = useState<DeckOverlayCtor | null>(cachedOverlayCtor);
  const [MapComponent, setMapComponent] = useState<MapLibreComponent | null>(getCachedMapLibreComponent);

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
    [deck.interleaved, deck.layers, deck.getTooltip, deck.onClick],
  );

  const handleLoad = useCallback(
    (m: MapLibreMapInstance) => {
      mapRef.current = m;
      if (!overlayCtor) {
        void loadDeckOverlayCtor().then((ctor) => {
          if (ctor && mapRef.current === m) {
            setOverlayCtor(() => ctor);
            ensureOverlay(ctor, m);
          }
        });
      } else {
        ensureOverlay(overlayCtor, m);
      }
      onLoad?.(m);
    },
    [ensureOverlay, onLoad, overlayCtor],
  );

  useEffect(() => {
    ensureOverlay(overlayCtor, mapRef.current);
  }, [ensureOverlay, overlayCtor]);

  // Update overlay when layers/tooltips change
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.setProps({
        layers: deck.layers || [],
        getTooltip: deck.getTooltip,
        onClick: deck.onClick,
      });
    }
  }, [deck.layers, deck.getTooltip, deck.onClick]);

  // Cleanup overlay on unmount
  useEffect(() => () => {
    if (overlayRef.current) {
      overlayRef.current.setProps({ layers: [] });
      overlayRef.current = null;
    }
  }, []);

  if (!MapComponent) {
    const fallbackStyle: React.CSSProperties = {
      width: (mapProps.width as string | number | undefined) ?? '100%',
      height: (mapProps.height as string | number | undefined) ?? '100%',
      position: 'relative',
      ...(normalizeStyle(mapProps.style) ?? {}),
    };
    return <div style={fallbackStyle} />;
  }

  return <MapComponent {...mapProps} onLoad={handleLoad} />;
};
