import {
  TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
  TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
  TREE_CONSOLE_ZOOM_BAND_MIN_RANGES,
  TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
  buildEvenZoomBandBoundaries,
  normalizeZoomBandBoundaries,
} from '@hierarchidb/util';
import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import type { TreeConsoleToolbarActionParams } from '~/types';

type RowClickAction = 'Select/Navigate' | 'Edit';

export interface UseSettingsMenuParams {
  onRowClickActionChange?: (action: RowClickAction) => void;
  onAutosaveEnabledChange?: (enabled: boolean) => void;
  onDialogBackdropDismissEnabledChange?: (enabled: boolean) => void;
  zoomBandBoundaries?: number[];
  onZoomBandBoundariesChange?: (boundaries: number[]) => void;
  onAction: (action: string, params?: TreeConsoleToolbarActionParams) => void;
}

export interface UseSettingsMenuResult {
  settingsAnchorEl: HTMLElement | null;
  settingsOpen: boolean;
  rangeCount: number;
  sliderValues: number[];
  handleSettingsClick: (event: MouseEvent<HTMLElement>) => void;
  handleMenuClose: () => void;
  handleRowClickChange: (value: RowClickAction) => void;
  handleAutosaveChange: (value: boolean) => void;
  handleDialogBackdropDismissChange: (value: boolean) => void;
  handleRangeCountChange: (_event: Event, value: number | number[]) => void;
  handleBoundariesChange: (_event: Event, value: number | number[]) => void;
}

export function useSettingsMenu({
  onRowClickActionChange,
  onAutosaveEnabledChange,
  onDialogBackdropDismissEnabledChange,
  zoomBandBoundaries,
  onZoomBandBoundariesChange,
  onAction,
}: UseSettingsMenuParams): UseSettingsMenuResult {
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);
  const settingsOpen = Boolean(settingsAnchorEl);

  const resolvedBoundaries = Array.isArray(zoomBandBoundaries)
    ? zoomBandBoundaries
    : TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES;

  const normalizedBoundaries = useMemo(
    () =>
      normalizeZoomBandBoundaries(
        resolvedBoundaries,
        TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
        TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
        TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
      ),
    [resolvedBoundaries],
  );

  const rangeCount = Math.min(
    Math.max(normalizedBoundaries.length - 1, TREE_CONSOLE_ZOOM_BAND_MIN_RANGES),
    TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
  );

  const handleMenuClose = useCallback(() => {
    setSettingsAnchorEl(null);
  }, []);

  const scheduleCloseSettingsMenu = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.setTimeout(handleMenuClose, 0);
    } else {
      handleMenuClose();
    }
  }, [handleMenuClose]);

  const handleSettingsClick = useCallback((event: MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(event.currentTarget);
  }, []);

  const handleRowClickChange = useCallback(
    (value: RowClickAction) => {
      if (onRowClickActionChange) {
        onRowClickActionChange(value);
      } else {
        onAction('setRowClickAction', value);
      }
      scheduleCloseSettingsMenu();
    },
    [onAction, onRowClickActionChange, scheduleCloseSettingsMenu],
  );

  const handleAutosaveChange = useCallback(
    (value: boolean) => {
      if (onAutosaveEnabledChange) {
        onAutosaveEnabledChange(value);
      } else {
        onAction('setAutosaveEnabled', value);
      }
      scheduleCloseSettingsMenu();
    },
    [onAction, onAutosaveEnabledChange, scheduleCloseSettingsMenu],
  );

  const handleDialogBackdropDismissChange = useCallback(
    (value: boolean) => {
      if (onDialogBackdropDismissEnabledChange) {
        onDialogBackdropDismissEnabledChange(value);
      } else {
        onAction('setDialogBackdropDismissEnabled', value);
      }
      scheduleCloseSettingsMenu();
    },
    [onAction, onDialogBackdropDismissEnabledChange, scheduleCloseSettingsMenu],
  );

  const handleZoomBandBoundariesChange = useCallback(
    (nextBoundaries: number[]) => {
      if (onZoomBandBoundariesChange) {
        onZoomBandBoundariesChange(nextBoundaries);
      } else {
        onAction('setZoomBandBoundaries', nextBoundaries);
      }
    },
    [onAction, onZoomBandBoundariesChange],
  );

  const handleRangeCountChange = useCallback(
    (_event: Event, value: number | number[]) => {
      const raw = Array.isArray(value) ? value[0] : value;
      if (typeof raw !== 'number') return;
      const currentMax =
        normalizedBoundaries[normalizedBoundaries.length - 1] ?? TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM;
      const nextBoundaries = buildEvenZoomBandBoundaries(raw, TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM, currentMax);
      handleZoomBandBoundariesChange(nextBoundaries);
    },
    [handleZoomBandBoundariesChange, normalizedBoundaries],
  );

  const handleBoundariesChange = useCallback(
    (_event: Event, value: number | number[]) => {
      if (!Array.isArray(value)) return;
      const nextValues = [...value];
      if (nextValues.length > 0) {
        nextValues[0] = TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM;
      }
      const nextBoundaries = normalizeZoomBandBoundaries(
        nextValues,
        TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
        TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
        TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
      );
      handleZoomBandBoundariesChange(nextBoundaries);
    },
    [handleZoomBandBoundariesChange],
  );

  return {
    settingsAnchorEl,
    settingsOpen,
    rangeCount,
    sliderValues: normalizedBoundaries,
    handleSettingsClick,
    handleMenuClose,
    handleRowClickChange,
    handleAutosaveChange,
    handleDialogBackdropDismissChange,
    handleRangeCountChange,
    handleBoundariesChange,
  };
}
