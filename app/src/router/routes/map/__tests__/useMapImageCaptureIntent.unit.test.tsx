import type { NodeId } from '@hierarchidb/core-types';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMapImageCaptureIntent } from '../useMapImageCaptureIntent.js';

const workerApi = {
  getMapImageCaptureIntent: vi.fn(),
};

vi.mock('@hierarchidb/ui-worker-client', () => ({
  ensureWorkerAPI: vi.fn(async () => workerApi),
}));

describe('useMapImageCaptureIntent', () => {
  beforeEach(() => {
    workerApi.getMapImageCaptureIntent.mockReset();
  });

  it('loads the capture intent through the worker state channel', async () => {
    workerApi.getMapImageCaptureIntent.mockResolvedValue({
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
    });

    const { result } = renderHook(() =>
      useMapImageCaptureIntent({
        nodeId: 'staging-root',
        captureIntentId: 'run-1:0',
      })
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(workerApi.getMapImageCaptureIntent).toHaveBeenCalledWith('run-1:0');
    expect(result.current.intent).toMatchObject({
      intentId: 'run-1:0',
      stagingRootNodeId: 'staging-root',
    });
  });

  it('reports an error when the intent targets another map node', async () => {
    workerApi.getMapImageCaptureIntent.mockResolvedValue({
      intentId: 'run-1:0',
      runId: 'run-1' as NodeId,
      stagingRootNodeId: 'another-root' as NodeId,
      browserMode: 'headed',
      mapRoute: {
        nodeId: 'another-root' as NodeId,
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
    });

    const { result } = renderHook(() =>
      useMapImageCaptureIntent({
        nodeId: 'staging-root',
        captureIntentId: 'run-1:0',
      })
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/targets another-root, not staging-root/);
  });
});
