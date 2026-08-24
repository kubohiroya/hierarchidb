import type { MapImageCaptureIntent } from './MapImageCaptureIntentTypes.js';

export { runMapImageCaptureBrowserHandoff };

export const MAP_IMAGE_CAPTURE_RENDER_STATUS_ATTRIBUTE = 'data-map-image-capture-render-status';
export const MAP_IMAGE_CAPTURE_READY_SELECTOR = `[${MAP_IMAGE_CAPTURE_RENDER_STATUS_ATTRIBUTE}="ready"]`;
export const MAP_IMAGE_CAPTURE_ERROR_SELECTOR = `[${MAP_IMAGE_CAPTURE_RENDER_STATUS_ATTRIBUTE}="error"]`;
export const MAP_IMAGE_CAPTURE_CANVAS_SELECTOR = '.maplibregl-canvas';

export type MapImageCaptureRouteMode = 'browser' | 'hash';

export type MapImageCaptureBrowserProgressPhase =
  | 'opening-map-ui'
  | 'waiting-render-ready'
  | 'capturing-canvas'
  | 'writing-output';

export type MapImageCaptureBrowserProgress = {
  phase: MapImageCaptureBrowserProgressPhase;
  percentage: number;
};

export type MapImageCapturePageFailureKind =
  | 'page-error'
  | 'unhandled-rejection'
  | 'webgl-context-lost';

export type MapImageCapturePageFailure = {
  kind: MapImageCapturePageFailureKind;
  message: string;
};

export interface MapImageCaptureBrowserPagePort {
  startPageFailureMonitoring(): Promise<void>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string): Promise<void>;
  waitForRenderStatus(input: {
    readySelector: string;
    errorSelector: string;
    timeoutMs: number;
  }): Promise<'ready' | 'error'>;
  assertNonBlankCanvas(input: { canvasSelector: string }): Promise<boolean>;
  collectPageFailures(): Promise<MapImageCapturePageFailure[]>;
  screenshot(input: { path: string; fullPage: false }): Promise<void>;
}

export interface PlaywrightLikeMapImageCapturePage {
  addInitScript(pageFunction: () => void): Promise<unknown>;
  on(event: 'pageerror', handler: (error: Error) => void): void;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string): Promise<unknown>;
  waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
  evaluate<R, A>(pageFunction: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  screenshot(options: { path: string; fullPage: false }): Promise<unknown>;
}

export interface CreateMapImageCaptureRouteUrlInput {
  baseUrl: string;
  intent: MapImageCaptureIntent;
  routeMode: MapImageCaptureRouteMode;
}

export interface RunMapImageCaptureBrowserHandoffInput extends CreateMapImageCaptureRouteUrlInput {
  page: MapImageCaptureBrowserPagePort;
  timeoutMs: number;
  reportProgress(progress: MapImageCaptureBrowserProgress): Promise<void>;
}

export const createMapImageCaptureRouteUrl = ({
  baseUrl,
  intent,
  routeMode,
}: CreateMapImageCaptureRouteUrlInput): string => {
  const url = new URL(baseUrl);
  const routePath = `/map/${encodeURIComponent(String(intent.mapRoute.nodeId))}`;
  const search = new URLSearchParams();
  search.set('captureIntentId', intent.mapRoute.search.captureIntentId);

  if (routeMode === 'hash') {
    url.hash = `${routePath}?${search.toString()}`;
    return url.toString();
  }

  url.pathname = joinUrlPath(url.pathname, routePath);
  url.search = search.toString();
  url.hash = '';
  return url.toString();
};

const runMapImageCaptureBrowserHandoff = async ({
  page,
  intent,
  baseUrl,
  routeMode,
  timeoutMs,
  reportProgress,
}: RunMapImageCaptureBrowserHandoffInput): Promise<void> => {
  const targetUrl = createMapImageCaptureRouteUrl({ baseUrl, intent, routeMode });
  await reportProgress({ phase: 'opening-map-ui', percentage: 25 });
  await page.startPageFailureMonitoring();
  await page.setViewportSize({
    width: intent.viewport.width,
    height: intent.viewport.height,
  });
  await page.goto(targetUrl);

  await reportProgress({ phase: 'waiting-render-ready', percentage: 50 });
  const renderStatus = await page.waitForRenderStatus({
    readySelector: MAP_IMAGE_CAPTURE_READY_SELECTOR,
    errorSelector: MAP_IMAGE_CAPTURE_ERROR_SELECTOR,
    timeoutMs,
  });
  if (renderStatus !== 'ready') {
    throw new Error('map-image-capture Map UI reported render error');
  }

  await reportProgress({ phase: 'capturing-canvas', percentage: 75 });
  const canvasIsNonBlank = await page.assertNonBlankCanvas({
    canvasSelector: MAP_IMAGE_CAPTURE_CANVAS_SELECTOR,
  });
  if (!canvasIsNonBlank) {
    throw new Error('map-image-capture Map UI rendered a blank canvas');
  }
  const pageFailures = await page.collectPageFailures();
  if (pageFailures.length > 0) {
    throw new Error(
      `map-image-capture Map UI browser failure: ${formatPageFailures(pageFailures)}`
    );
  }

  await reportProgress({ phase: 'writing-output', percentage: 90 });
  await page.screenshot({ path: intent.output.path, fullPage: false });
};

export const createPlaywrightMapImageCapturePagePort = (
  page: PlaywrightLikeMapImageCapturePage
): MapImageCaptureBrowserPagePort => {
  const pageFailures: MapImageCapturePageFailure[] = [];
  return {
    startPageFailureMonitoring: async () => {
      await page.addInitScript(installMapImageCaptureFailureListeners);
      page.on('pageerror', (error) => {
        pageFailures.push({ kind: 'page-error', message: error.message });
      });
    },
    setViewportSize: (size) => page.setViewportSize(size),
    goto: async (url) => {
      await page.goto(url);
    },
    waitForRenderStatus: async ({ readySelector, errorSelector, timeoutMs }) => {
      const status = await Promise.race([
        page.waitForSelector(readySelector, { timeout: timeoutMs }).then(() => 'ready' as const),
        page.waitForSelector(errorSelector, { timeout: timeoutMs }).then(() => 'error' as const),
      ]);
      return status;
    },
    assertNonBlankCanvas: async ({ canvasSelector }) => {
      return page.evaluate(isCanvasNonBlank, canvasSelector);
    },
    collectPageFailures: async () => {
      const browserFailures = await page.evaluate(readMapImageCaptureFailures, undefined);
      return [...pageFailures, ...browserFailures];
    },
    screenshot: async (input) => {
      await page.screenshot(input);
    },
  };
};

const joinUrlPath = (basePath: string, routePath: string): string => {
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  return `${normalizedBase}${routePath}`;
};

const isCanvasNonBlank = (canvasSelector: string): boolean => {
  const canvas = document.querySelector(canvasSelector);
  if (!(canvas instanceof HTMLCanvasElement)) {
    return false;
  }
  if (canvas.width <= 0 || canvas.height <= 0) {
    return false;
  }

  const webgl2 = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  if (webgl2) {
    return isWebGlCanvasNonBlank(webgl2);
  }

  const webgl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (webgl) {
    return isWebGlCanvasNonBlank(webgl);
  }

  const context2d = canvas.getContext('2d', { willReadFrequently: true });
  if (!context2d) {
    return false;
  }
  const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
  return isMapImageCapturePixelBufferNonBlank(pixels);
};

const isWebGlCanvasNonBlank = (gl: WebGLRenderingContext | WebGL2RenderingContext): boolean => {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (width <= 0 || height <= 0) {
    return false;
  }

  const samplePoints = [
    [Math.floor(width / 2), Math.floor(height / 2)],
    [Math.floor(width / 4), Math.floor(height / 4)],
    [Math.floor((width * 3) / 4), Math.floor(height / 4)],
    [Math.floor(width / 4), Math.floor((height * 3) / 4)],
    [Math.floor((width * 3) / 4), Math.floor((height * 3) / 4)],
  ] as const;

  const pixel = new Uint8Array(4);
  for (const [x, y] of samplePoints) {
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (isMapImageCapturePixelBufferNonBlank(pixel)) {
      return true;
    }
  }
  return false;
};

export const isMapImageCapturePixelBufferNonBlank = (
  pixels: Uint8Array | Uint8ClampedArray
): boolean => {
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const alpha = pixels[index + 3] ?? 0;
    if (red > 0 || green > 0 || blue > 0 || alpha > 0) {
      return true;
    }
  }
  return false;
};

const formatPageFailures = (failures: MapImageCapturePageFailure[]): string => {
  return failures.map((failure) => `${failure.kind}: ${failure.message}`).join('; ');
};

type WindowWithMapImageCaptureFailures = Window &
  typeof globalThis & {
    __hierarchidbMapImageCaptureFailures?: MapImageCapturePageFailure[];
  };

const installMapImageCaptureFailureListeners = (): void => {
  const targetWindow = window as WindowWithMapImageCaptureFailures;
  if (!Array.isArray(targetWindow.__hierarchidbMapImageCaptureFailures)) {
    targetWindow.__hierarchidbMapImageCaptureFailures = [];
  }
  const failures = targetWindow.__hierarchidbMapImageCaptureFailures;
  window.addEventListener('unhandledrejection', (event) => {
    failures.push({
      kind: 'unhandled-rejection',
      message: stringifyBrowserFailureReason(event.reason),
    });
  });
  window.addEventListener(
    'webglcontextlost',
    () => {
      failures.push({
        kind: 'webgl-context-lost',
        message: 'WebGL context lost',
      });
    },
    true
  );
};

const readMapImageCaptureFailures = (): MapImageCapturePageFailure[] => {
  const targetWindow = window as WindowWithMapImageCaptureFailures;
  return [...(targetWindow.__hierarchidbMapImageCaptureFailures ?? [])];
};

const stringifyBrowserFailureReason = (reason: unknown): string => {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  return String(reason);
};
