import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import {
  createMapImageCaptureRouteUrl,
  createPlaywrightMapImageCapturePagePort,
  isMapImageCapturePixelBufferNonBlank,
  MAP_IMAGE_CAPTURE_CANVAS_SELECTOR,
  MAP_IMAGE_CAPTURE_ERROR_SELECTOR,
  MAP_IMAGE_CAPTURE_READY_SELECTOR,
  type MapImageCaptureBrowserPagePort,
  type MapImageCaptureBrowserProgress,
  type MapImageCaptureIntent,
  type MapImageCapturePageFailure,
  type PlaywrightLikeMapImageCapturePage,
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
    expect(page.startPageFailureMonitoring).toHaveBeenCalledOnce();
    expect(page.goto).toHaveBeenCalledWith(
      'http://localhost:3000/map/staging-root?captureIntentId=run-1%3A0'
    );
    expect(page.waitForRenderStatus).toHaveBeenCalledWith({
      readySelector: MAP_IMAGE_CAPTURE_READY_SELECTOR,
      errorSelector: MAP_IMAGE_CAPTURE_ERROR_SELECTOR,
      timeoutMs: 5000,
    });
    expect(page.assertNonBlankCanvas).toHaveBeenCalledWith({
      canvasSelector: MAP_IMAGE_CAPTURE_CANVAS_SELECTOR,
    });
    expect(page.collectPageFailures).toHaveBeenCalledOnce();
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

  it('fails before screenshot when render readiness times out', async () => {
    const page = createPagePort('ready');
    vi.mocked(page.waitForRenderStatus).mockRejectedValueOnce(new Error('render timeout'));

    await expect(
      runMapImageCaptureBrowserHandoff({
        page,
        intent: createIntent(),
        baseUrl: 'http://localhost:3000/',
        routeMode: 'browser',
        timeoutMs: 5000,
        reportProgress: async () => {},
      })
    ).rejects.toThrow(/render timeout/);
    expect(page.assertNonBlankCanvas).not.toHaveBeenCalled();
    expect(page.screenshot).not.toHaveBeenCalled();
  });

  it('fails before screenshot when the rendered canvas is blank', async () => {
    const page = createPagePort('ready', false);

    await expect(
      runMapImageCaptureBrowserHandoff({
        page,
        intent: createIntent(),
        baseUrl: 'http://localhost:3000/',
        routeMode: 'browser',
        timeoutMs: 5000,
        reportProgress: async () => {},
      })
    ).rejects.toThrow(/blank canvas/);
    expect(page.screenshot).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'page-error' as const, message: 'render crashed' }, /page-error: render crashed/],
    [
      { kind: 'unhandled-rejection' as const, message: 'failed to load layer' },
      /unhandled-rejection: failed to load layer/,
    ],
    [
      { kind: 'webgl-context-lost' as const, message: 'WebGL context lost' },
      /webgl-context-lost: WebGL context lost/,
    ],
  ])('fails before screenshot when the page reports %s', async (failure, expectedMessage) => {
    const page = createPagePort('ready', true, [failure]);

    await expect(
      runMapImageCaptureBrowserHandoff({
        page,
        intent: createIntent(),
        baseUrl: 'http://localhost:3000/',
        routeMode: 'browser',
        timeoutMs: 5000,
        reportProgress: async () => {},
      })
    ).rejects.toThrow(expectedMessage);
    expect(page.screenshot).not.toHaveBeenCalled();
  });
});

describe('isMapImageCapturePixelBufferNonBlank', () => {
  it('treats opaque black pixels as nonblank rendered content', () => {
    expect(isMapImageCapturePixelBufferNonBlank(new Uint8Array([0, 0, 0, 255]))).toBe(true);
  });

  it('treats fully transparent zero pixels as blank', () => {
    expect(isMapImageCapturePixelBufferNonBlank(new Uint8Array([0, 0, 0, 0]))).toBe(false);
  });
});

describe('createPlaywrightMapImageCapturePagePort', () => {
  it('adapts a Playwright-like page to the map image capture page port', async () => {
    const page = createPlaywrightLikePage('ready');
    const port = createPlaywrightMapImageCapturePagePort(page);

    await port.startPageFailureMonitoring();
    await port.setViewportSize({ width: 320, height: 240 });
    await port.goto('http://localhost:3000/map/node');
    await expect(
      port.waitForRenderStatus({
        readySelector: MAP_IMAGE_CAPTURE_READY_SELECTOR,
        errorSelector: MAP_IMAGE_CAPTURE_ERROR_SELECTOR,
        timeoutMs: 5000,
      })
    ).resolves.toBe('ready');
    await expect(
      port.assertNonBlankCanvas({ canvasSelector: MAP_IMAGE_CAPTURE_CANVAS_SELECTOR })
    ).resolves.toBe(true);
    await expect(port.collectPageFailures()).resolves.toEqual([]);
    await port.screenshot({ path: 'exports/out.png', fullPage: false });

    expect(page.addInitScript).toHaveBeenCalled();
    expect(page.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 320, height: 240 });
    expect(page.goto).toHaveBeenCalledWith('http://localhost:3000/map/node');
    expect(page.waitForSelector).toHaveBeenCalledWith(MAP_IMAGE_CAPTURE_READY_SELECTOR, {
      timeout: 5000,
    });
    expect(page.evaluate).toHaveBeenCalled();
    expect(page.screenshot).toHaveBeenCalledWith({ path: 'exports/out.png', fullPage: false });
  });
});

const createPagePort = (
  renderStatus: 'ready' | 'error',
  canvasIsNonBlank = true,
  pageFailures: MapImageCapturePageFailure[] = []
): MapImageCaptureBrowserPagePort => ({
  startPageFailureMonitoring: vi.fn(async () => {}),
  setViewportSize: vi.fn(async () => {}),
  goto: vi.fn(async () => {}),
  waitForRenderStatus: vi.fn(async () => renderStatus),
  assertNonBlankCanvas: vi.fn(async () => canvasIsNonBlank),
  collectPageFailures: vi.fn(async () => pageFailures),
  screenshot: vi.fn(async () => {}),
});

const createPlaywrightLikePage = (
  renderStatus: 'ready' | 'error'
): PlaywrightLikeMapImageCapturePage => ({
  addInitScript: vi.fn(async () => {}),
  on: vi.fn(() => {}),
  setViewportSize: vi.fn(async () => {}),
  goto: vi.fn(async () => {}),
  waitForSelector: vi.fn(async (selector: string) => {
    if (
      (renderStatus === 'ready' && selector === MAP_IMAGE_CAPTURE_READY_SELECTOR) ||
      (renderStatus === 'error' && selector === MAP_IMAGE_CAPTURE_ERROR_SELECTOR)
    ) {
      return {};
    }
    return new Promise(() => {});
  }),
  evaluate: vi.fn(async (_pageFunction, arg) => (arg === undefined ? [] : true)),
  screenshot: vi.fn(async () => {}),
});
