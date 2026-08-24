import type { NodeId } from '@hierarchidb/core-types';
import type { MapImageCaptureIntentRecord } from '@hierarchidb/staged-folder-action';
import type { MapLibreMapInstance } from '@hierarchidb/ui-plugin-shell/ui-map';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMapImageCaptureReadiness } from '../useMapImageCaptureReadiness.js';

type IdleHandler = (...args: unknown[]) => void;

const createIntent = (
  patch?: Partial<MapImageCaptureIntentRecord>
): MapImageCaptureIntentRecord => ({
  intentId: 'run-1:0',
  runId: 'run-1' as NodeId,
  stagingRootNodeId: 'staging-root' as NodeId,
  browserMode: 'headless',
  mapRoute: {
    nodeId: 'staging-root' as NodeId,
    search: { captureIntentId: 'run-1:0' },
  },
  viewport: {
    bbox: [139, 35, 140, 36],
    width: 800,
    height: 600,
  },
  layers: [{ path: '.', visible: true }],
  output: { path: 'exports/out.png' },
  createdAt: 100,
  updatedAt: 100,
  ...patch,
});

const createMap = () => {
  let idleHandler: IdleHandler | null = null;
  const map = {
    fitBounds: vi.fn(),
    once: vi.fn((event: string, handler: IdleHandler) => {
      if (event === 'idle') {
        idleHandler = handler;
      }
    }),
    off: vi.fn(),
  } as unknown as MapLibreMapInstance;
  return {
    map,
    fireIdle: () => {
      idleHandler?.();
    },
  };
};

describe('useMapImageCaptureReadiness', () => {
  it('fits the map to the capture bbox and reports ready after map idle', async () => {
    const { map, fireIdle } = createMap();
    const intent = createIntent();

    const { result } = renderHook(() =>
      useMapImageCaptureReadiness({
        intentState: { status: 'ready', intent, error: null },
        mapInstance: map,
      })
    );

    await waitFor(() => expect(result.current.status).toBe('applying-viewport'));
    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [139, 35],
        [140, 36],
      ],
      { padding: 0 }
    );

    act(() => fireIdle());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('reports an error for an invalid capture bbox', async () => {
    const { map } = createMap();
    const intent = createIntent({
      viewport: {
        bbox: [140, 35, 139, 36],
        width: 800,
        height: 600,
      },
    });

    const { result } = renderHook(() =>
      useMapImageCaptureReadiness({
        intentState: { status: 'ready', intent, error: null },
        mapInstance: map,
      })
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/viewport\.bbox must be ordered/);
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('reports an error before fitting the map when requested layers failed to load', async () => {
    const { map } = createMap();
    const intent = createIntent();

    const { result } = renderHook(() =>
      useMapImageCaptureReadiness({
        intentState: { status: 'ready', intent, error: null },
        mapInstance: map,
        layerLoadError: 'map-image-capture layer path was not found: Missing',
      })
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('map-image-capture layer path was not found: Missing');
    expect(map.fitBounds).not.toHaveBeenCalled();
  });
});
