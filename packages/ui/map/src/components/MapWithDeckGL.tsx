/**
 * @file MapWithDeckGL.tsx
 * @description MapLibre + Deck.gl overlay integration using MapboxOverlay.
 * The Deck.gl dependency stays optional via peerDependencies.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MapLibreMap } from './MapLibreMap.js';
import type { IControl } from 'maplibre-gl';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';
import type { MapboxOverlay as DeckMapboxOverlay } from '@deck.gl/mapbox';

export interface DeckOverlayProps {
  layers: any[];
  interleaved?: boolean;
  getTooltip?: (info: any) => any;
  onClick?: (info: any) => void;
}

export interface MapWithDeckGLProps extends React.ComponentProps<typeof MapLibreMap> {
  deck: DeckOverlayProps;
}

type DeckOverlayCtor = typeof DeckMapboxOverlay;

type DeckOverlayControl = IControl & {
  setProps: (props: DeckOverlayProps) => void;
};

let cachedOverlayCtor: DeckOverlayCtor | null = null;
let overlayCtorPromise: Promise<DeckOverlayCtor | null> | null = null;

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

  return <MapLibreMap {...mapProps} onLoad={handleLoad} />;
};

export default MapWithDeckGL;
