import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { MapHighlightState, MapHighlightStyles } from '../types/index.js';
import { MapHighlightService } from '../services/MapHighlightService.js';

interface UseMapHighlightProps {
  mapInstance?: any; //  MapLibre GL JS
  initialStyles?: Partial<MapHighlightStyles>;
  onStateChange?: (state: MapHighlightState) => void;
}

interface UseMapHighlightReturn {
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
  service: MapHighlightService;
}

export const useMapHighlight = ({
                                  mapInstance,
                                  initialStyles,
                                  onStateChange,
                                }: UseMapHighlightProps): UseMapHighlightReturn => {
  const serviceRef = useRef<MapHighlightService>();
  const [highlightState, setHighlightState] = useState<MapHighlightState>({
    searchMatched: new Set(),
    selected: new Set(),
    focused: null,
    styles: {
      searchMatch: {
        fillColor: '#FFE066',
        fillOpacity: 0.7,
      },
      selection: {
        strokeColor: '#FF6B6B',
        strokeWidth: 3,
        strokeOpacity: 0.8,
      },
    },
  });

  if (!serviceRef.current) {
    serviceRef.current = new MapHighlightService(initialStyles, mapInstance);
    serviceRef.current.setOnStateChange((state: MapHighlightState) => {
      setHighlightState(state);
      if (onStateChange) {
        onStateChange(state);
      }
    });
  }

  useEffect(() => {
    if (mapInstance && serviceRef.current) {
      serviceRef.current.setMapInstance(mapInstance);
    }
  }, [mapInstance]);

  const setSearchMatched = useCallback((nodeIds: NodeId[]) => {
    serviceRef.current?.setSearchMatched(nodeIds);
  }, []);

  const setSelected = useCallback((nodeIds: NodeId[]) => {
    serviceRef.current?.setSelected(nodeIds);
  }, []);

  const addSearchMatched = useCallback((nodeId: NodeId) => {
    serviceRef.current?.addSearchMatched(nodeId);
  }, []);

  const addSelected = useCallback((nodeId: NodeId) => {
    serviceRef.current?.addSelected(nodeId);
  }, []);

  const removeSearchMatched = useCallback((nodeId: NodeId) => {
    serviceRef.current?.removeSearchMatched(nodeId);
  }, []);

  const removeSelected = useCallback((nodeId: NodeId) => {
    serviceRef.current?.removeSelected(nodeId);
  }, []);

  const clearAll = useCallback(() => {
    serviceRef.current?.clearAll();
  }, []);

  const clearSearchMatched = useCallback(() => {
    serviceRef.current?.clearSearchMatched();
  }, []);

  const clearSelected = useCallback(() => {
    serviceRef.current?.clearSelected();
  }, []);

  const updateStyles = useCallback((styles: Partial<MapHighlightStyles>) => {
    serviceRef.current?.updateStyles(styles);
  }, []);

  return {
    highlightState,
    setSearchMatched,
    setSelected,
    addSearchMatched,
    addSelected,
    removeSearchMatched,
    removeSelected,
    clearAll,
    clearSearchMatched,
    clearSelected,
    updateStyles,
    service: serviceRef.current,
  };
};
