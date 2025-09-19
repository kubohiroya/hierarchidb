/**
 * @file MapWithDeckGL.tsx
 * @description MapLibre + Deck.gl overlay integration using MapboxOverlay.
 * The Deck.gl dependency stays optional via peerDependencies.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { MapLibreMap } from './MapLibreMap.js';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';

export interface DeckOverlayProps {
  layers: any[];
  interleaved?: boolean;
  getTooltip?: (info: any) => any;
  onClick?: (info: any) => void;
}

export interface MapWithDeckGLProps extends React.ComponentProps<typeof MapLibreMap> {
  deck: DeckOverlayProps;
}

export const MapWithDeckGL: React.FC<MapWithDeckGLProps> = ({ deck, onLoad, ...mapProps }) => {
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const overlayRef = useRef<any>(null);

  const OverlayCtor = useMemo(() => {
    // Lazy require to avoid hard dependency at import time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@deck.gl/mapbox').MapboxOverlay;
  }, []);

  const handleLoad = useCallback(
    (m: MapLibreMapInstance) => {
      mapRef.current = m;
      // Create overlay once
      if (!overlayRef.current) {
        overlayRef.current = new OverlayCtor({
          interleaved: deck.interleaved ?? true,
          layers: deck.layers || [],
          getTooltip: deck.getTooltip,
          onClick: deck.onClick,
        });
        m.addControl(overlayRef.current as any);
      }
      onLoad?.(m);
    },
    [OverlayCtor, deck.getTooltip, deck.layers, deck.onClick, deck.interleaved, onLoad],
  );

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
      try {
        overlayRef.current.setProps({ layers: [] });
      } catch {
      }
      overlayRef.current = null;
    }
  }, []);

  return <MapLibreMap {...mapProps} onLoad={handleLoad} />;
};

export default MapWithDeckGL;

