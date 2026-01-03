import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { MapViewState } from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  formatZxyParam,
  type MapViewState as LoaderMapViewState,
} from '../../loaders/mapLoader.js';

export type UseMapViewStateParams = {
  nodeId?: string;
  searchZxy?: string;
  loaderViewState: LoaderMapViewState;
  geolocation: { latitude?: number | null; longitude?: number | null; error?: unknown };
};

export type UseMapViewStateResult = {
  initialViewState: MapViewState;
  formattedZxy: string;
  handleViewStateChange: (viewState: MapViewState) => void;
  applyPersistedZxy: (viewState: MapViewState) => void;
};

export const useMapViewState = ({
  nodeId,
  searchZxy,
  loaderViewState,
  geolocation,
}: UseMapViewStateParams): UseMapViewStateResult => {
  const navigate = useNavigate();
  const [initialViewState, setInitialViewState] = useState<MapViewState>(() => ({
    longitude: loaderViewState.longitude,
    latitude: loaderViewState.latitude,
    zoom: loaderViewState.zoom,
  }));
  const persistedZxyApplied = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastUpdateRef = useRef<string>(formatZxyParam(loaderViewState));

  useEffect(() => {
    setInitialViewState({
      longitude: loaderViewState.longitude,
      latitude: loaderViewState.latitude,
      zoom: loaderViewState.zoom,
    });
    lastUpdateRef.current = formatZxyParam(loaderViewState);
  }, [loaderViewState]);

  const applyPersistedZxy = useCallback(
    (viewState: MapViewState) => {
      if (!nodeId || searchZxy || persistedZxyApplied.current) return;
      persistedZxyApplied.current = true;
      setInitialViewState(viewState);
      const formatted = formatZxyParam(viewState);
      lastUpdateRef.current = formatted;
      navigate({
        to: '/map/$nodeId',
        params: { nodeId },
        search: (prev: { zxy?: string } = {}) => ({ ...prev, zxy: formatted }),
        replace: true,
      });
    },
    [navigate, nodeId, searchZxy]
  );

  useEffect(() => {
    if (!searchZxy && !persistedZxyApplied.current && geolocation.latitude && geolocation.longitude && !geolocation.error) {
      setInitialViewState({
        longitude: geolocation.longitude,
        latitude: geolocation.latitude,
        zoom: 1,
      });
    }
  }, [geolocation.latitude, geolocation.longitude, geolocation.error, searchZxy]);

  const handleViewStateChange = useCallback(
    (viewState: MapViewState) => {
      if (!nodeId) return;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        const newZxy = formatZxyParam(viewState);
        if (newZxy !== lastUpdateRef.current) {
          lastUpdateRef.current = newZxy;
          navigate({
            to: '/map/$nodeId',
            params: { nodeId },
            search: (prev: { zxy?: string } = {}) => ({ ...prev, zxy: newZxy }),
            replace: true,
          });
        }
      }, 500);
    },
    [navigate, nodeId]
  );

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const formattedZxy = useMemo(() => formatZxyParam(initialViewState), [initialViewState]);

  return {
    initialViewState,
    formattedZxy,
    handleViewStateChange,
    applyPersistedZxy,
  };
};
