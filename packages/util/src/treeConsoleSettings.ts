import type { BuildContinuationPolicy } from '../../build-api';
import {
  buildEvenZoomBandBoundaries as buildEvenZoomBandBoundariesBase,
  DEFAULT_ZOOM_BAND_BOUNDARIES,
  normalizeZoomBandBoundaries as normalizeZoomBandBoundariesBase,
  ZOOM_BAND_MAX_RANGES,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_RANGES,
  ZOOM_BAND_MIN_ZOOM,
} from './zoomBandSettings.js';

export const TREE_CONSOLE_SETTINGS_STORAGE_KEY = 'hdb.treeConsole.settings';
export const TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM = ZOOM_BAND_MIN_ZOOM;
export const TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM = ZOOM_BAND_MAX_ZOOM;
export const TREE_CONSOLE_ZOOM_BAND_MIN_RANGES = ZOOM_BAND_MIN_RANGES;
export const TREE_CONSOLE_ZOOM_BAND_MAX_RANGES = ZOOM_BAND_MAX_RANGES;
export const TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES = DEFAULT_ZOOM_BAND_BOUNDARIES;

export type TreeConsoleSettings = {
  rowClickAction?: 'Select/Navigate' | 'Edit';
  autosaveEnabled?: boolean;
  dialogBackdropDismissEnabled?: boolean;
  zoomBandBoundaries?: number[];
  buildContinuationPolicy?: BuildContinuationPolicy;
};

const defaultSettings: Required<
  Pick<
    TreeConsoleSettings,
    | 'autosaveEnabled'
    | 'dialogBackdropDismissEnabled'
    | 'zoomBandBoundaries'
    | 'buildContinuationPolicy'
  >
> = {
  autosaveEnabled: false,
  dialogBackdropDismissEnabled: false,
  zoomBandBoundaries: TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  buildContinuationPolicy: 'finish_all_stages',
};

const safeGlobal = (): typeof window | null => {
  if (typeof window === 'undefined') return null;
  return window;
};

const isBuildContinuationPolicy = (value?: string): value is BuildContinuationPolicy =>
  value === 'finish_all_stages' ||
  value === 'finish_stage_then_stop' ||
  value === 'stop_on_first_error';

export const normalizeZoomBandBoundaries = (
  boundaries: number[],
  minZoom = TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
  maxZoom = TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
  maxRanges = TREE_CONSOLE_ZOOM_BAND_MAX_RANGES
): number[] => normalizeZoomBandBoundariesBase(boundaries, minZoom, maxZoom, maxRanges);

export const buildEvenZoomBandBoundaries = (
  rangeCount: number,
  minZoom = TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
  maxZoom = TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM
): number[] => buildEvenZoomBandBoundariesBase(rangeCount, minZoom, maxZoom);

export function loadTreeConsoleSettings(): TreeConsoleSettings {
  const global = safeGlobal();
  if (!global?.localStorage) return { ...defaultSettings };

  try {
    const raw = global.localStorage.getItem(TREE_CONSOLE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw) as Partial<TreeConsoleSettings> | null;
    const rowClickAction =
      parsed?.rowClickAction === 'Edit' || parsed?.rowClickAction === 'Select/Navigate'
        ? parsed.rowClickAction
        : undefined;
    const autosaveEnabled =
      typeof parsed?.autosaveEnabled === 'boolean'
        ? parsed.autosaveEnabled
        : defaultSettings.autosaveEnabled;
    const dialogBackdropDismissEnabled =
      typeof parsed?.dialogBackdropDismissEnabled === 'boolean'
        ? parsed.dialogBackdropDismissEnabled
        : defaultSettings.dialogBackdropDismissEnabled;
    const parsedZoomBandBoundaries = parsed?.zoomBandBoundaries;
    const zoomBandBoundaries = Array.isArray(parsedZoomBandBoundaries)
      ? normalizeZoomBandBoundaries(
          parsedZoomBandBoundaries,
          TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
          TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
          TREE_CONSOLE_ZOOM_BAND_MAX_RANGES
        )
      : defaultSettings.zoomBandBoundaries;
    const parsedBuildContinuationPolicy = parsed?.buildContinuationPolicy;
    const buildContinuationPolicy = isBuildContinuationPolicy(parsedBuildContinuationPolicy)
      ? parsedBuildContinuationPolicy
      : defaultSettings.buildContinuationPolicy;
    return {
      rowClickAction,
      autosaveEnabled,
      dialogBackdropDismissEnabled,
      zoomBandBoundaries,
      buildContinuationPolicy,
    };
  } catch (err) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[treeConsoleSettings] failed to parse settings; using defaults', err);
    }
    return { ...defaultSettings };
  }
}

export function saveTreeConsoleSettings(patch: Partial<TreeConsoleSettings>): TreeConsoleSettings {
  const global = safeGlobal();
  const current = loadTreeConsoleSettings();
  const next: TreeConsoleSettings = {
    rowClickAction: patch.rowClickAction ?? current.rowClickAction,
    autosaveEnabled:
      patch.autosaveEnabled !== undefined ? patch.autosaveEnabled : current.autosaveEnabled,
    dialogBackdropDismissEnabled:
      patch.dialogBackdropDismissEnabled !== undefined
        ? patch.dialogBackdropDismissEnabled
        : current.dialogBackdropDismissEnabled,
    zoomBandBoundaries:
      patch.zoomBandBoundaries !== undefined
        ? normalizeZoomBandBoundaries(
            patch.zoomBandBoundaries,
            TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
            TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
            TREE_CONSOLE_ZOOM_BAND_MAX_RANGES
          )
        : (current.zoomBandBoundaries ?? defaultSettings.zoomBandBoundaries),
    buildContinuationPolicy: patch.buildContinuationPolicy ?? current.buildContinuationPolicy,
  };

  if (!global?.localStorage) return next;

  try {
    global.localStorage.setItem(TREE_CONSOLE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(
        '[treeConsoleSettings] failed to save settings; continuing with memory copy',
        err
      );
    }
  }
  return next;
}
