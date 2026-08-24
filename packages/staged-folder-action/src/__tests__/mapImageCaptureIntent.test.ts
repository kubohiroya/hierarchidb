import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import { createMapImageCaptureIntent } from '../index.js';

describe('createMapImageCaptureIntent', () => {
  it('creates a handoff intent for the existing map route', () => {
    expect(
      createMapImageCaptureIntent({
        runId: 'run-1' as NodeId,
        stagingRootNodeId: 'staging-root' as NodeId,
        actionIndex: 2,
        browserMode: 'headless',
        action: {
          type: 'map-image-capture',
          mode: 'map-ui',
          output: { path: 'exports/tokyo.png', width: 1280, height: 720 },
          viewport: { bbox: [139.5, 35.5, 140, 36] },
          layers: [
            { path: '.', visible: true },
            { path: 'routes/main', visible: false },
          ],
        },
      })
    ).toEqual({
      intentId: 'run-1:2',
      runId: 'run-1',
      stagingRootNodeId: 'staging-root',
      browserMode: 'headless',
      mapRoute: {
        nodeId: 'staging-root',
        search: {
          captureIntentId: 'run-1:2',
        },
      },
      viewport: {
        bbox: [139.5, 35.5, 140, 36],
        width: 1280,
        height: 720,
      },
      layers: [
        { path: '.', visible: true },
        { path: 'routes/main', visible: false },
      ],
      output: {
        path: 'exports/tokyo.png',
      },
    });
  });

  it('rejects invalid viewport sizes instead of normalizing them', () => {
    expect(() =>
      createMapImageCaptureIntent({
        runId: 'run-1' as NodeId,
        stagingRootNodeId: 'staging-root' as NodeId,
        actionIndex: 0,
        browserMode: 'headed',
        action: {
          type: 'map-image-capture',
          mode: 'map-ui',
          output: { path: 'exports/tokyo.png', width: 0, height: 720 },
          viewport: { bbox: [139.5, 35.5, 140, 36] },
          layers: [{ path: '.', visible: true }],
        },
      })
    ).toThrow(/action\.output\.width must be a positive integer/);
  });
});
