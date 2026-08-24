import type { MapImageCaptureIntentRecord } from '@hierarchidb/staged-folder-action';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import { useEffect, useState } from 'react';

export type MapImageCaptureIntentLoadState =
  | { status: 'idle'; intent: null; error: null }
  | { status: 'loading'; intent: null; error: null }
  | { status: 'ready'; intent: MapImageCaptureIntentRecord; error: null }
  | { status: 'missing'; intent: null; error: string }
  | { status: 'error'; intent: null; error: string };

export type UseMapImageCaptureIntentParams = {
  nodeId?: string;
  captureIntentId?: string;
};

const idleState: MapImageCaptureIntentLoadState = {
  status: 'idle',
  intent: null,
  error: null,
};

export const useMapImageCaptureIntent = ({
  nodeId,
  captureIntentId,
}: UseMapImageCaptureIntentParams): MapImageCaptureIntentLoadState => {
  const [state, setState] = useState<MapImageCaptureIntentLoadState>(idleState);

  useEffect(() => {
    if (!captureIntentId) {
      setState(idleState);
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', intent: null, error: null });
    void ensureWorkerAPI()
      .then((api) => api.getMapImageCaptureIntent(captureIntentId))
      .then((intent) => {
        if (cancelled) return;
        if (!intent) {
          setState({
            status: 'missing',
            intent: null,
            error: `map-image-capture intent ${captureIntentId} was not found`,
          });
          return;
        }
        if (nodeId && String(intent.stagingRootNodeId) !== nodeId) {
          setState({
            status: 'error',
            intent: null,
            error: `map-image-capture intent ${captureIntentId} targets ${String(
              intent.stagingRootNodeId
            )}, not ${nodeId}`,
          });
          return;
        }
        setState({ status: 'ready', intent, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          intent: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [captureIntentId, nodeId]);

  return state;
};
