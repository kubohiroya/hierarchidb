/**
 * @file MapWithDeckGL.tsx
 * @description MapLibre + Deck.gl overlay integration using MapboxOverlay.
 * The Deck.gl dependency stays optional via peerDependencies.
 */

import type { Layer, PickingInfo } from '@deck.gl/core';
import type React from 'react';
import type { MapLibreMapProps } from './MapLibreMap.js';
import { useMapWithDeckGL } from './useMapWithDeckGL.js';

export interface DeckOverlayProps {
  layers: Layer[];
  interleaved?: boolean;
  getTooltip?: (info: PickingInfo) => DeckTooltip;
  onClick?: (info: PickingInfo) => void;
}

export type MapWithDeckGLProps = MapLibreMapProps & {
  deck: DeckOverlayProps;
};

type DeckTooltip =
  | null
  | string
  | {
      text?: string;
      html?: string;
      className?: string;
      style?: Partial<CSSStyleDeclaration>;
    };

export const MapWithDeckGL: React.FC<MapWithDeckGLProps> = ({ deck, onLoad, ...mapProps }) => {
  const { MapComponent, handleLoad, fallbackStyle } = useMapWithDeckGL({
    deck,
    onLoad,
    ...mapProps,
  });

  if (!MapComponent) {
    return <div style={fallbackStyle} />;
  }

  return <MapComponent {...mapProps} onLoad={handleLoad} />;
};
