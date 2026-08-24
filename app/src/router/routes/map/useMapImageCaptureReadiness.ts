import type { MapImageCaptureIntentRecord } from '@hierarchidb/staged-folder-action';
import type { MapLibreMapInstance } from '@hierarchidb/ui-plugin-shell/ui-map';
import { useEffect, useState } from 'react';
import type { MapImageCaptureIntentLoadState } from './useMapImageCaptureIntent.js';

export type MapImageCaptureRenderStatus =
  | 'idle'
  | 'waiting-intent'
  | 'waiting-map'
  | 'applying-viewport'
  | 'ready'
  | 'error';

export type MapImageCaptureReadinessState = {
  status: MapImageCaptureRenderStatus;
  error: string | null;
};

export type UseMapImageCaptureReadinessParams = {
  intentState: MapImageCaptureIntentLoadState;
  mapInstance: MapLibreMapInstance | null;
};

const idleState: MapImageCaptureReadinessState = {
  status: 'idle',
  error: null,
};

const assertFiniteNumber = (value: number, name: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`map-image-capture ${name} must be a finite number`);
  }
};

const assertValidIntentViewport = (intent: MapImageCaptureIntentRecord): void => {
  const { bbox, width, height } = intent.viewport;
  if (bbox.length !== 4) {
    throw new Error('map-image-capture viewport.bbox must contain four numbers');
  }
  const [minLng, minLat, maxLng, maxLat] = bbox;
  assertFiniteNumber(minLng, 'viewport.bbox[0]');
  assertFiniteNumber(minLat, 'viewport.bbox[1]');
  assertFiniteNumber(maxLng, 'viewport.bbox[2]');
  assertFiniteNumber(maxLat, 'viewport.bbox[3]');
  assertFiniteNumber(width, 'viewport.width');
  assertFiniteNumber(height, 'viewport.height');
  if (width <= 0 || height <= 0) {
    throw new Error('map-image-capture viewport width and height must be greater than zero');
  }
  if (minLng >= maxLng || minLat >= maxLat) {
    throw new Error(
      'map-image-capture viewport.bbox must be ordered as [minLng, minLat, maxLng, maxLat]'
    );
  }
};

export const useMapImageCaptureReadiness = ({
  intentState,
  mapInstance,
}: UseMapImageCaptureReadinessParams): MapImageCaptureReadinessState => {
  const [state, setState] = useState<MapImageCaptureReadinessState>(idleState);
  const intentStatus = intentState.status;
  const intentError = intentState.error;
  const intent = intentState.status === 'ready' ? intentState.intent : null;

  useEffect(() => {
    if (intentStatus === 'idle') {
      setState(idleState);
      return;
    }
    if (intentStatus !== 'ready' || !intent) {
      setState({ status: 'waiting-intent', error: intentError });
      return;
    }
    if (!mapInstance) {
      setState({ status: 'waiting-map', error: null });
      return;
    }

    let cancelled = false;
    try {
      assertValidIntentViewport(intent);
      const [minLng, minLat, maxLng, maxLat] = intent.viewport.bbox;
      setState({ status: 'applying-viewport', error: null });
      const handleIdle = () => {
        if (cancelled) return;
        setState({ status: 'ready', error: null });
      };
      mapInstance.once('idle', handleIdle);
      mapInstance.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 0 }
      );
      return () => {
        cancelled = true;
        mapInstance.off('idle', handleIdle);
      };
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }, [intent, intentError, intentStatus, mapInstance]);

  return state;
};
