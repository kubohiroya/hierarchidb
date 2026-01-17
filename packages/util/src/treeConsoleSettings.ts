import type { BuildContinuationPolicy } from '@hierarchidb/common-types';

export const TREE_CONSOLE_SETTINGS_STORAGE_KEY = 'hdb.treeConsole.settings';
export const TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM = 0;
export const TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM = 11;
export const TREE_CONSOLE_ZOOM_BAND_MIN_RANGES = 0;
export const TREE_CONSOLE_ZOOM_BAND_MAX_RANGES = 10;
export const TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES = [0, 3, 6];

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
    'autosaveEnabled' | 'dialogBackdropDismissEnabled' | 'zoomBandBoundaries' | 'buildContinuationPolicy'
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isBuildContinuationPolicy = (value?: string): value is BuildContinuationPolicy => (
  value === 'finish_all_stages'
  || value === 'finish_stage_then_stop'
  || value === 'stop_on_first_error'
);

export const normalizeZoomBandBoundaries = (
  boundaries: number[],
  minZoom = TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
  maxZoom = TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
  maxRanges = TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
): number[] => {
  const maxHandles = Math.max(1, maxRanges + 1);
  const raw = boundaries
    .map((value) => Math.round(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
    .slice(0, maxHandles);

  if (raw.length === 0) {
    return [minZoom];
  }

  const normalized: number[] = [minZoom];
  const lastRaw = raw[raw.length - 1];
  const resolvedLast = clamp(
    typeof lastRaw === 'number' ? lastRaw : minZoom,
    minZoom,
    maxZoom,
  );

  const middle = raw.filter((value) => value > minZoom && value < resolvedLast);
  const maxMiddle = Math.max(0, maxHandles - 2);
  const trimmed = middle.slice(0, maxMiddle);

  for (let i = 0; i < trimmed.length; i += 1) {
    const remaining = trimmed.length - i - 1;
    const prev = normalized[normalized.length - 1]!;
    const minValue = Math.max(prev + 1, minZoom);
    const maxValue = Math.max(minValue, resolvedLast - remaining - 1);
    normalized.push(clamp(trimmed[i]!, minValue, maxValue));
  }

  if (normalized.length < maxHandles && resolvedLast > normalized[normalized.length - 1]!) {
    normalized.push(Math.max(resolvedLast, normalized[normalized.length - 1]!));
  }

  return normalized;
};

export const buildEvenZoomBandBoundaries = (
  rangeCount: number,
  minZoom = TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
  maxZoom = TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
): number[] => {
  if (rangeCount <= 0) return [minZoom];
  if (rangeCount === 1) return [minZoom, maxZoom];
  const span = maxZoom - minZoom;
  const raw = Array.from({ length: rangeCount + 1 }, (_, index) => {
    const fraction = index / rangeCount;
    return minZoom + span * fraction;
  });
  return normalizeZoomBandBoundaries(raw, minZoom, maxZoom, rangeCount);
};

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
          TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
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
            TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
          )
        : current.zoomBandBoundaries ?? defaultSettings.zoomBandBoundaries,
    buildContinuationPolicy: patch.buildContinuationPolicy ?? current.buildContinuationPolicy,
  };

  if (!global?.localStorage) return next;

  try {
    global.localStorage.setItem(TREE_CONSOLE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[treeConsoleSettings] failed to save settings; continuing with memory copy', err);
    }
  }
  return next;
}
