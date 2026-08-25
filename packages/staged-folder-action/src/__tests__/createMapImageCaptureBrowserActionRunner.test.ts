import path from 'node:path';
import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import {
  createMapImageCaptureBrowserActionRunner,
  createPlaywrightMapImageCaptureBrowserLauncher,
  type PlaywrightMapImageCaptureModule,
  resolveMapImageCaptureOutputPath,
} from '../createMapImageCaptureBrowserActionRunner.js';
import {
  MAP_IMAGE_CAPTURE_CANVAS_SELECTOR,
  MAP_IMAGE_CAPTURE_ERROR_SELECTOR,
  MAP_IMAGE_CAPTURE_READY_SELECTOR,
  type MapImageCaptureBrowserPagePort,
  type MapImageCaptureIntent,
  type PlaywrightLikeMapImageCapturePage,
} from '../index.js';

const outputBasePath = path.resolve('/tmp/hdb-capture-output');

const createIntent = (patch?: Partial<MapImageCaptureIntent>): MapImageCaptureIntent => ({
  intentId: 'run-1:1',
  runId: 'run-1' as NodeId,
  stagingRootNodeId: 'staging-root' as NodeId,
  browserMode: 'headless',
  mapRoute: {
    nodeId: 'staging-root' as NodeId,
    search: { captureIntentId: 'run-1:1' },
  },
  viewport: {
    bbox: [139, 35, 140, 36],
    width: 800,
    height: 600,
  },
  layers: [{ path: '.', visible: true }],
  output: { path: 'exports/map.png' },
  ...patch,
});

const config = {
  version: 1,
  staging: { mode: 'temporary-copy', cleanup: 'retain' },
  overlay: { nodes: [] },
  actions: [],
} as const;

describe('createMapImageCaptureBrowserActionRunner', () => {
  it('launches headless mode and captures through the shared page port', async () => {
    const page = {} as PlaywrightLikeMapImageCapturePage;
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => {}),
    };
    const launchBrowser = vi.fn(async () => browser);
    const pagePort = createPagePort();
    const createPort = vi.fn(() => pagePort);
    const progress: Array<{ phase: string; percentage: number }> = [];
    const runner = createMapImageCaptureBrowserActionRunner({
      baseUrl: 'http://localhost:3000/app/',
      routeMode: 'hash',
      timeoutMs: 5000,
      outputBasePath,
      launchBrowser,
      createPagePort: createPort,
    });

    await runner({
      intent: createIntent(),
      config,
      stagingRootNodeId: 'staging-root' as NodeId,
      runId: 'run-1' as NodeId,
      reportProgress: async (update) => {
        progress.push(update);
      },
    });

    expect(launchBrowser).toHaveBeenCalledWith({ browserMode: 'headless' });
    expect(browser.newPage).toHaveBeenCalledOnce();
    expect(createPort).toHaveBeenCalledWith(page);
    expect(pagePort.goto).toHaveBeenCalledWith(
      'http://localhost:3000/app/#/map/staging-root?captureIntentId=run-1%3A1'
    );
    expect(pagePort.waitForRenderStatus).toHaveBeenCalledWith({
      readySelector: MAP_IMAGE_CAPTURE_READY_SELECTOR,
      errorSelector: MAP_IMAGE_CAPTURE_ERROR_SELECTOR,
      timeoutMs: 5000,
    });
    expect(pagePort.assertNonBlankCanvas).toHaveBeenCalledWith({
      canvasSelector: MAP_IMAGE_CAPTURE_CANVAS_SELECTOR,
    });
    expect(pagePort.screenshot).toHaveBeenCalledWith({
      path: path.join(outputBasePath, 'exports/map.png'),
      fullPage: false,
    });
    expect(progress.map((update) => update.phase)).toEqual([
      'opening-map-ui',
      'waiting-render-ready',
      'capturing-canvas',
      'writing-output',
    ]);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('fails unsafe output paths before launching the browser', async () => {
    const launchBrowser = vi.fn(async () => ({
      newPage: vi.fn(async () => ({}) as PlaywrightLikeMapImageCapturePage),
      close: vi.fn(async () => {}),
    }));
    const runner = createMapImageCaptureBrowserActionRunner({
      baseUrl: 'http://localhost:3000/',
      routeMode: 'browser',
      timeoutMs: 5000,
      outputBasePath,
      launchBrowser,
    });

    await expect(
      runner({
        intent: createIntent({ output: { path: 'exports/../map.png' } }),
        config,
        stagingRootNodeId: 'staging-root' as NodeId,
        runId: 'run-1' as NodeId,
        reportProgress: async () => {},
      })
    ).rejects.toThrow(/outputPath must not contain empty, current-directory, or parent-directory/);
    expect(launchBrowser).not.toHaveBeenCalled();
  });

  it('launches headed mode without changing the normal Map UI route', async () => {
    const browser = {
      newPage: vi.fn(async () => ({}) as PlaywrightLikeMapImageCapturePage),
      close: vi.fn(async () => {}),
    };
    const launchBrowser = vi.fn(async () => browser);
    const pagePort = createPagePort();
    const runner = createMapImageCaptureBrowserActionRunner({
      baseUrl: 'http://localhost:3000/',
      routeMode: 'browser',
      timeoutMs: 5000,
      outputBasePath,
      launchBrowser,
      createPagePort: () => pagePort,
    });

    await runner({
      intent: createIntent({ browserMode: 'headed' }),
      config,
      stagingRootNodeId: 'staging-root' as NodeId,
      runId: 'run-1' as NodeId,
      reportProgress: async () => {},
    });

    expect(launchBrowser).toHaveBeenCalledWith({ browserMode: 'headed' });
    expect(pagePort.goto).toHaveBeenCalledWith(
      'http://localhost:3000/map/staging-root?captureIntentId=run-1%3A1'
    );
  });

  it('closes the browser when render readiness fails', async () => {
    const browser = {
      newPage: vi.fn(async () => ({}) as PlaywrightLikeMapImageCapturePage),
      close: vi.fn(async () => {}),
    };
    const runner = createMapImageCaptureBrowserActionRunner({
      baseUrl: 'http://localhost:3000/',
      routeMode: 'browser',
      timeoutMs: 5000,
      outputBasePath,
      launchBrowser: async () => browser,
      createPagePort: () => createPagePort('error'),
    });

    await expect(
      runner({
        intent: createIntent(),
        config,
        stagingRootNodeId: 'staging-root' as NodeId,
        runId: 'run-1' as NodeId,
        reportProgress: async () => {},
      })
    ).rejects.toThrow(/Map UI reported render error/);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('preserves the capture failure when browser close also fails', async () => {
    const browser = {
      newPage: vi.fn(async () => ({}) as PlaywrightLikeMapImageCapturePage),
      close: vi.fn(async () => {
        throw new Error('close failed');
      }),
    };
    const runner = createMapImageCaptureBrowserActionRunner({
      baseUrl: 'http://localhost:3000/',
      routeMode: 'browser',
      timeoutMs: 5000,
      outputBasePath,
      launchBrowser: async () => browser,
      createPagePort: () => createPagePort('error'),
    });

    await expect(
      runner({
        intent: createIntent(),
        config,
        stagingRootNodeId: 'staging-root' as NodeId,
        runId: 'run-1' as NodeId,
        reportProgress: async () => {},
      })
    ).rejects.toThrow(/Map UI reported render error; browser close failed: close failed/);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('fails fast for invalid host configuration', () => {
    expect(() =>
      createMapImageCaptureBrowserActionRunner({
        baseUrl: 'not-a-url',
        routeMode: 'browser',
        timeoutMs: 5000,
        outputBasePath,
        launchBrowser: async () => ({
          newPage: vi.fn(async () => ({}) as PlaywrightLikeMapImageCapturePage),
          close: vi.fn(async () => {}),
        }),
      })
    ).toThrow(/baseUrl/);
    expect(() =>
      createMapImageCaptureBrowserActionRunner({
        baseUrl: 'http://localhost:3000/',
        routeMode: 'browser',
        timeoutMs: 0,
        outputBasePath,
        launchBrowser: async () => ({
          newPage: vi.fn(async () => ({}) as PlaywrightLikeMapImageCapturePage),
          close: vi.fn(async () => {}),
        }),
      })
    ).toThrow(/timeoutMs/);
    expect(() =>
      createMapImageCaptureBrowserActionRunner({
        baseUrl: 'http://localhost:3000/',
        routeMode: 'browser',
        timeoutMs: 5000,
        outputBasePath: 'relative-output',
        launchBrowser: async () => ({
          newPage: vi.fn(async () => ({}) as PlaywrightLikeMapImageCapturePage),
          close: vi.fn(async () => {}),
        }),
      })
    ).toThrow(/outputBasePath/);
  });
});

describe('resolveMapImageCaptureOutputPath', () => {
  it('resolves relative output paths against the explicit output base path', () => {
    expect(
      resolveMapImageCaptureOutputPath({
        outputPath: 'exports/map.png',
        outputBasePath,
      })
    ).toBe(path.join(outputBasePath, 'exports/map.png'));
  });

  it('rejects absolute output paths', () => {
    expect(() =>
      resolveMapImageCaptureOutputPath({
        outputPath: path.resolve('/tmp/hdb-map.png'),
        outputBasePath,
      })
    ).toThrow(/outputPath must be relative to outputBasePath/);
  });

  it('rejects unsafe output path segments', () => {
    for (const outputPath of [
      '\0map.png',
      'exports/\0map.png',
      '../map.png',
      'exports/../map.png',
      'exports/./map.png',
      'exports//map.png',
    ]) {
      expect(() =>
        resolveMapImageCaptureOutputPath({
          outputPath,
          outputBasePath,
        })
      ).toThrow(/outputPath must not contain empty, current-directory, or parent-directory/);
    }
  });
});

describe('createPlaywrightMapImageCaptureBrowserLauncher', () => {
  it('maps headless and headed modes to Playwright launch options', async () => {
    const launch = vi.fn(async () => ({
      newPage: vi.fn(async () => ({}) as PlaywrightLikeMapImageCapturePage),
      close: vi.fn(async () => {}),
    }));
    const launcher = createPlaywrightMapImageCaptureBrowserLauncher({
      launchArgs: ['--use-gl=swiftshader'],
      loadPlaywright: async () => ({ chromium: { launch } }),
    });

    await launcher({ browserMode: 'headless' });
    await launcher({ browserMode: 'headed' });

    expect(launch).toHaveBeenNthCalledWith(1, {
      headless: true,
      args: ['--use-gl=swiftshader'],
    });
    expect(launch).toHaveBeenNthCalledWith(2, {
      headless: false,
      args: ['--use-gl=swiftshader'],
    });
  });

  it('rejects invalid Playwright modules and launch args', async () => {
    expect(() =>
      createPlaywrightMapImageCaptureBrowserLauncher({
        launchArgs: [' valid ', ''],
        loadPlaywright: async () => ({ chromium: { launch: vi.fn() } }),
      })
    ).toThrow(/launchArgs/);
    const launcher = createPlaywrightMapImageCaptureBrowserLauncher({
      launchArgs: [],
      loadPlaywright: async () => ({ chromium: {} }) as PlaywrightMapImageCaptureModule,
    });

    await expect(launcher({ browserMode: 'headless' })).rejects.toThrow(/chromium.launch/);
  });
});

const createPagePort = (
  renderStatus: 'ready' | 'error' = 'ready'
): MapImageCaptureBrowserPagePort => ({
  startPageFailureMonitoring: vi.fn(async () => {}),
  setViewportSize: vi.fn(async () => {}),
  goto: vi.fn(async () => {}),
  waitForRenderStatus: vi.fn(async () => renderStatus),
  assertNonBlankCanvas: vi.fn(async () => true),
  collectPageFailures: vi.fn(async () => []),
  screenshot: vi.fn(async () => {}),
});
