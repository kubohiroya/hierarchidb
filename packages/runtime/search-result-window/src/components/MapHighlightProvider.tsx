import React, { createContext, useContext, ReactNode } from 'react';
import type { NodeId } from '@hierarchidb/core';
import type { MapHighlightState, MapHighlightStyles } from '~/types';
import { useMapHighlight } from '~/hooks/useMapHighlight';

interface MapHighlightContextValue {
  highlightState: MapHighlightState;
  setSearchMatched: (nodeIds: NodeId[]) => void;
  setSelected: (nodeIds: NodeId[]) => void;
  addSearchMatched: (nodeId: NodeId) => void;
  addSelected: (nodeId: NodeId) => void;
  removeSearchMatched: (nodeId: NodeId) => void;
  removeSelected: (nodeId: NodeId) => void;
  clearAll: () => void;
  clearSearchMatched: () => void;
  clearSelected: () => void;
  updateStyles: (styles: Partial<MapHighlightStyles>) => void;
}

const MapHighlightContext = createContext<MapHighlightContextValue | null>(null);

interface MapHighlightProviderProps {
  children: ReactNode;
  mapInstance?: any;
  initialStyles?: Partial<MapHighlightStyles>;
  onStateChange?: (state: MapHighlightState) => void;
}

/**
 * 地図ハイライト機能を提供するコンテキストプロバイダー
 */
export const MapHighlightProvider: React.FC<MapHighlightProviderProps> = ({
  children,
  mapInstance,
  initialStyles,
  onStateChange,
}) => {
  const mapHighlight = useMapHighlight({
    mapInstance,
    initialStyles,
    onStateChange,
  });

  return (
    <MapHighlightContext.Provider value={mapHighlight}>
      {children}
    </MapHighlightContext.Provider>
  );
};

/**
 * 地図ハイライト機能を使用するフック
 */
export const useMapHighlightContext = (): MapHighlightContextValue => {
  const context = useContext(MapHighlightContext);
  if (!context) {
    throw new Error('useMapHighlightContext must be used within MapHighlightProvider');
  }
  return context;
};