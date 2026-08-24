import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import {
  createMapImageCaptureRouteUrl,
  MAP_IMAGE_CAPTURE_ERROR_SELECTOR,
  MAP_IMAGE_CAPTURE_READY_SELECTOR,
  type MapImageCaptureBrowserPagePort,
  type MapImageCaptureBrowserProgress,
  type MapImageCaptureIntent,
  runMapImageCaptureBrowserHandoff,
} from '../index.js';

const createIntent = (patch?: Partial<MapImageCaptureIntent>): MapImageCaptureIntent => ({
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
  ...patch,
});

describe('createMapImageCaptureRouteUrl', () => {
  it('creates a browser-router URL for the normal map route', () => {
    expect(
      createMapImageCaptureRouteUrl({
        baseUrl: 'http://localhost:3000/app/',
        intent: createIntent(),
        routeMode: 'browser',
      })
    ).toBe('http://localhost:3000/app/map/staging-root?captureIntentId=run-1%3A0');
  });

  it('creates a hash-router URL for the normal map route', () => {
    expect(
      createMapImageCaptureRouteUrl({
        baseUrl: 'http://localhost:3000/app/',
        intent: createIntent(),
        routeMode: 'hash',
      })
    ).toBe('http://localhost:3000/app/#/map/staging-root?captureIntentId=run-1%3A0');
  });
});

describe('runMapImageCaptureBrowserHandoff', () => {
  it('opens the normal Map UI, waits for readiness, and writes the screenshot', async () => {
    const page = createPagePort('ready');
    const progress: MapImageCaptureBrowserProgress[] = [];

    await runMapImageCaptureBrowserHandoff({
      page,
      intent: createIntent(),
      baseUrl: 'http://localhost:3000/',
      routeMode: 'browser',
      timeoutMs: 5000,
      reportProgress: async (update) => {
        progress.push(update);
      },
    });

    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 800, height: 600 });
    expect(page.goto).toHaveBeenCalledWith(
      'http://localhost:3000/map/staging-root?captureIntentId=run-1%3A0'
    );
    expect(page.waitForRenderStatus).toHaveBeenCalledWith({
      readySelector: MAP_IMAGE_CAPTURE_READY_SELECTOR,
      errorSelector: MAP_IMAGE_CAPTURE_ERROR_SELECTOR,
      timeoutMs: 5000,
    });
    expect(page.screenshot).toHaveBeenCalledWith({ path: 'exports/out.png', fullPage: false });
    expect(progress.map((update) => update.phase)).toEqual([
      'opening-map-ui',
      'waiting-render-ready',
      'capturing-canvas',
      'writing-output',
    ]);
  });

  it('fails before screenshot when the Map UI reports render error', async () => {
    const page = createPagePort('error');

    await expect(
      runMapImageCaptureBrowserHandoff({
        page,
        intent: createIntent(),
        baseUrl: 'http://localhost:3000/',
        routeMode: 'browser',
        timeoutMs: 5000,
        reportProgress: async () => {},
      })
    ).rejects.toThrow(/Map UI reported render error/);
    expect(page.screenshot).not.toHaveBeenCalled();
  });
});

const createPagePort = (renderStatus: 'ready' | 'error'): MapImageCaptureBrowserPagePort => ({
  setViewportSize: vi.fn(async () => {}),
  goto: vi.fn(async () => {}),
  waitForRenderStatus: vi.fn(async () => renderStatus),
  screenshot: vi.fn(async () => {}),
});
