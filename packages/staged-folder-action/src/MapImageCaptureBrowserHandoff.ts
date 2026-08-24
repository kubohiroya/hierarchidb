import type { MapImageCaptureIntent } from './MapImageCaptureIntentTypes.js';

export const MAP_IMAGE_CAPTURE_RENDER_STATUS_ATTRIBUTE = 'data-map-image-capture-render-status';
export const MAP_IMAGE_CAPTURE_READY_SELECTOR = `[${MAP_IMAGE_CAPTURE_RENDER_STATUS_ATTRIBUTE}="ready"]`;
export const MAP_IMAGE_CAPTURE_ERROR_SELECTOR = `[${MAP_IMAGE_CAPTURE_RENDER_STATUS_ATTRIBUTE}="error"]`;

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

export interface MapImageCaptureBrowserPagePort {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string): Promise<void>;
  waitForRenderStatus(input: {
    readySelector: string;
    errorSelector: string;
    timeoutMs: number;
  }): Promise<'ready' | 'error'>;
  screenshot(input: { path: string; fullPage: false }): Promise<void>;
}

export interface PlaywrightLikeMapImageCapturePage {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string): Promise<unknown>;
  waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
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

export const runMapImageCaptureBrowserHandoff = async ({
  page,
  intent,
  baseUrl,
  routeMode,
  timeoutMs,
  reportProgress,
}: RunMapImageCaptureBrowserHandoffInput): Promise<void> => {
  const targetUrl = createMapImageCaptureRouteUrl({ baseUrl, intent, routeMode });
  await reportProgress({ phase: 'opening-map-ui', percentage: 25 });
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
  await reportProgress({ phase: 'writing-output', percentage: 90 });
  await page.screenshot({ path: intent.output.path, fullPage: false });
};

export const createPlaywrightMapImageCapturePagePort = (
  page: PlaywrightLikeMapImageCapturePage
): MapImageCaptureBrowserPagePort => ({
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
  screenshot: async (input) => {
    await page.screenshot(input);
  },
});

const joinUrlPath = (basePath: string, routePath: string): string => {
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  return `${normalizedBase}${routePath}`;
};
