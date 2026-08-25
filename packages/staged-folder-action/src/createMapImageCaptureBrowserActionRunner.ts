import path from 'node:path';
import type { NodeId } from '@hierarchidb/core-types';
import type { MapImageCaptureIntent } from './MapImageCaptureIntentTypes.js';
import {
  createPlaywrightMapImageCapturePagePort,
  type MapImageCaptureBrowserPagePort,
  type MapImageCaptureRouteMode,
  type PlaywrightLikeMapImageCapturePage,
  runMapImageCaptureBrowserHandoff,
} from './runMapImageCaptureBrowserHandoff.js';
import type { StagedFolderActionConfig } from './StagedFolderActionManifestTypes.js';

export type MapImageCaptureActionProgressUpdate = {
  phase: string;
  percentage: number;
};

export type MapImageCaptureBrowserActionRunnerInput = {
  intent: MapImageCaptureIntent;
  config: StagedFolderActionConfig;
  stagingRootNodeId: NodeId;
  runId: NodeId;
  reportProgress(update: MapImageCaptureActionProgressUpdate): Promise<void>;
};

export type MapImageCaptureBrowserActionRunner = (
  input: MapImageCaptureBrowserActionRunnerInput
) => Promise<void>;

export type MapImageCaptureBrowserLaunchInput = {
  browserMode: MapImageCaptureIntent['browserMode'];
};

export type MapImageCaptureBrowserInstance = {
  newPage(): Promise<PlaywrightLikeMapImageCapturePage>;
  close(): Promise<void>;
};

export type MapImageCaptureBrowserLauncher = (
  input: MapImageCaptureBrowserLaunchInput
) => Promise<MapImageCaptureBrowserInstance>;

export type PlaywrightMapImageCaptureBrowser = {
  newPage(): Promise<PlaywrightLikeMapImageCapturePage>;
  close(): Promise<void>;
};

export type PlaywrightMapImageCaptureChromium = {
  launch(input: {
    headless: boolean;
    args: readonly string[];
  }): Promise<PlaywrightMapImageCaptureBrowser>;
};

export type PlaywrightMapImageCaptureModule = {
  chromium: PlaywrightMapImageCaptureChromium;
};

export type CreateMapImageCaptureBrowserActionRunnerInput = {
  baseUrl: string;
  routeMode: MapImageCaptureRouteMode;
  timeoutMs: number;
  outputBasePath: string;
  launchBrowser: MapImageCaptureBrowserLauncher;
  createPagePort?: (page: PlaywrightLikeMapImageCapturePage) => MapImageCaptureBrowserPagePort;
};

export type CreatePlaywrightMapImageCaptureBrowserLauncherInput = {
  launchArgs: readonly string[];
  loadPlaywright?: () => Promise<PlaywrightMapImageCaptureModule>;
};

export function createMapImageCaptureBrowserActionRunner({
  baseUrl,
  routeMode,
  timeoutMs,
  outputBasePath,
  launchBrowser,
  createPagePort = createPlaywrightMapImageCapturePagePort,
}: CreateMapImageCaptureBrowserActionRunnerInput): MapImageCaptureBrowserActionRunner {
  assertValidBaseUrl(baseUrl);
  assertPositiveInteger(timeoutMs, 'timeoutMs');
  assertAbsolutePath(outputBasePath, 'outputBasePath');
  return async ({ intent, reportProgress }) => {
    const outputPath = resolveMapImageCaptureOutputPath({
      outputPath: intent.output.path,
      outputBasePath,
    });
    const browser = await launchBrowser({ browserMode: intent.browserMode });
    let captureError: unknown;
    try {
      const page = await browser.newPage();
      const pagePort = createPagePort(page);
      await runMapImageCaptureBrowserHandoff({
        page: pagePort,
        intent: {
          ...intent,
          output: {
            path: outputPath,
          },
        },
        baseUrl,
        routeMode,
        timeoutMs,
        reportProgress,
      });
    } catch (error) {
      captureError = error;
    }
    try {
      await browser.close();
    } catch (closeError) {
      if (captureError !== undefined) {
        throw new Error(
          `${errorMessage(captureError)}; browser close failed: ${errorMessage(closeError)}`,
          { cause: captureError }
        );
      }
      throw closeError;
    }
    if (captureError !== undefined) {
      throw captureError;
    }
  };
}

export function createPlaywrightMapImageCaptureBrowserLauncher({
  launchArgs,
  loadPlaywright = loadDefaultPlaywrightModule,
}: CreatePlaywrightMapImageCaptureBrowserLauncherInput): MapImageCaptureBrowserLauncher {
  assertStringArray(launchArgs, 'launchArgs');
  return async ({ browserMode }) => {
    const playwright = await loadPlaywright();
    assertPlaywrightModule(playwright);
    return playwright.chromium.launch({
      headless: browserMode === 'headless',
      args: [...launchArgs],
    });
  };
}

export function resolveMapImageCaptureOutputPath({
  outputPath,
  outputBasePath,
}: {
  outputPath: string;
  outputBasePath: string;
}): string {
  assertNonEmptyTrimmedString(outputPath, 'outputPath');
  assertAbsolutePath(outputBasePath, 'outputBasePath');
  if (path.isAbsolute(outputPath)) {
    throw new Error('outputPath must be relative to outputBasePath');
  }
  if (
    outputPath.includes('\0') ||
    outputPath
      .split('/')
      .some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error(
      'outputPath must not contain empty, current-directory, or parent-directory segments'
    );
  }
  return path.resolve(outputBasePath, outputPath);
}

const assertValidBaseUrl = (value: string): void => {
  assertNonEmptyTrimmedString(value, 'baseUrl');
  try {
    new URL(value);
  } catch {
    throw new Error('baseUrl must be a valid URL');
  }
};

const assertAbsolutePath = (value: string, field: string): void => {
  assertNonEmptyTrimmedString(value, field);
  if (!path.isAbsolute(value)) {
    throw new Error(`${field} must be an absolute path`);
  }
};

const assertNonEmptyTrimmedString = (value: string, field: string): void => {
  if (value.length === 0 || value !== value.trim()) {
    throw new Error(`${field} must be a non-empty trimmed string`);
  }
};

const assertPositiveInteger = (value: number, field: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
};

const assertStringArray = (value: readonly string[], field: string): void => {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  value.forEach((item, index) => {
    assertNonEmptyTrimmedString(item, `${field}[${index}]`);
  });
};

const assertPlaywrightModule = (value: PlaywrightMapImageCaptureModule): void => {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('chromium' in value) ||
    typeof value.chromium !== 'object' ||
    value.chromium === null ||
    !('launch' in value.chromium) ||
    typeof value.chromium.launch !== 'function'
  ) {
    throw new Error('playwright module must expose chromium.launch');
  }
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const loadDefaultPlaywrightModule = async (): Promise<PlaywrightMapImageCaptureModule> => {
  return (await import('@playwright/test')) as PlaywrightMapImageCaptureModule;
};
