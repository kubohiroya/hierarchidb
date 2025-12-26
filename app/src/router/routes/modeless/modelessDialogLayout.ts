/**
 * @file modelessDialogLayout.ts
 * @description Modeless dialog layout persistence helpers.
 */

import type { DialogDisplayMode, DialogPosition, DialogSize } from '@hierarchidb/common-types';
import {
  getPresetSize,
  getViewportSize,
  initialPosition,
  normalizeDialogState,
} from '@hierarchidb/ui-dialog';

export const STORAGE_VERSION = 1;
export const STORAGE_KEY_PREFIX = 'hdb.map.dialogs';
export const WINDOW_OFFSET_STEP = 28;

export type MapDialogDefinitionBase = {
  id: string;
  defaultSize: DialogSize;
};

export type MapDialogWindowState = {
  id: string;
  position: DialogPosition;
  size: DialogSize;
  displayMode: DialogDisplayMode;
  isVisible: boolean;
  isMinimized: boolean;
  iconPosition?: DialogPosition;
  lastNormalPosition?: DialogPosition;
  lastNormalSize?: DialogSize;
};

export type ModelessIconPlacement = {
  anchor?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  offset?: { x: number; y: number };
  spacing?: number;
};

export type MapDialogLayout = {
  version: number;
  windows: Record<string, MapDialogWindowState>;
  order: string[];
};

const DEFAULT_ICON_PLACEMENT: Required<ModelessIconPlacement> = {
  anchor: 'bottom-right',
  offset: { x: 16, y: 16 },
  spacing: 12,
};

const ICON_BOX_SIZE = 48;

function resolveIconPosition(
  index: number,
  viewport: { width: number; height: number },
  placement?: ModelessIconPlacement,
): DialogPosition {
  const resolved = { ...DEFAULT_ICON_PLACEMENT, ...placement };
  const offset = resolved.offset ?? DEFAULT_ICON_PLACEMENT.offset;
  const spacing = resolved.spacing ?? DEFAULT_ICON_PLACEMENT.spacing;
  const anchor = resolved.anchor ?? DEFAULT_ICON_PLACEMENT.anchor;
  let x = offset.x;
  let y = offset.y;

  if (anchor.includes('right')) {
    x = Math.max(viewport.width - offset.x - ICON_BOX_SIZE, 0);
  }
  if (anchor.includes('bottom')) {
    y = Math.max(viewport.height - offset.y - ICON_BOX_SIZE, 0);
  }

  if (anchor.includes('top')) {
    y = y + index * spacing;
  } else {
    y = y - index * spacing;
  }

  return { x, y };
}

export function buildDefaultLayout(
  definitions: MapDialogDefinitionBase[],
  viewport: { width: number; height: number },
  iconPlacement?: ModelessIconPlacement,
): MapDialogLayout {
  const windows: Record<string, MapDialogWindowState> = {};
  const order: string[] = [];

  definitions.forEach((definition, index) => {
    const offset = WINDOW_OFFSET_STEP * index;
    const position: DialogPosition = { x: 16 + offset, y: 16 + offset };
    const normalized = normalizeDialogState(definition.defaultSize, position, viewport, {
      enforceTopLeftMargin: true,
      clampSizeToViewport: true,
    });
    const iconPosition = resolveIconPosition(index, viewport, iconPlacement);
    windows[definition.id] = {
      id: definition.id,
      position: normalized.position,
      size: normalized.size,
      displayMode: 'normal',
      isVisible: true,
      isMinimized: false,
      iconPosition,
      lastNormalPosition: normalized.position,
      lastNormalSize: normalized.size,
    };
    order.push(definition.id);
  });

  return { version: STORAGE_VERSION, windows, order };
}

export function applyDisplayMode(
  windowState: MapDialogWindowState,
  mode: DialogDisplayMode,
  viewport: { width: number; height: number } = getViewportSize(),
): MapDialogWindowState {
  const next: MapDialogWindowState = { ...windowState, displayMode: mode, isMinimized: false };
  let nextSize = next.size;
  let nextPosition = next.position;

  if (windowState.displayMode === 'normal' && mode !== 'normal') {
    next.lastNormalPosition = windowState.position;
    next.lastNormalSize = windowState.size;
  }

  if (mode === 'full-screen') {
    nextSize = {
      width: Math.max(viewport.width, 1),
      height: Math.max(viewport.height, 1),
    };
    nextPosition = { x: 0, y: 0 };
  } else if (mode === 'maximize') {
    const preset = getPresetSize('maximize', viewport);
    const normalized = normalizeDialogState(preset, initialPosition(preset, viewport), viewport, {
      enforceTopLeftMargin: false,
      clampSizeToViewport: true,
    });
    nextSize = normalized.size;
    nextPosition = normalized.position;
  } else {
    const fallbackSize = next.lastNormalSize ?? getPresetSize('normal', viewport);
    const fallbackPosition = next.lastNormalPosition ?? initialPosition(fallbackSize, viewport);
    const normalized = normalizeDialogState(fallbackSize, fallbackPosition, viewport, {
      enforceTopLeftMargin: true,
      clampSizeToViewport: true,
    });
    nextSize = normalized.size;
    nextPosition = normalized.position;
  }

  return { ...next, size: nextSize, position: nextPosition };
}

export function mergeLayout(
  prev: MapDialogLayout,
  definitions: MapDialogDefinitionBase[],
  iconPlacement?: ModelessIconPlacement,
): MapDialogLayout {
  const viewport = getViewportSize();
  const defaults = buildDefaultLayout(definitions, viewport, iconPlacement);
  let changed = false;

  const windows: Record<string, MapDialogWindowState> = {};

  definitions.forEach((definition) => {
    const existing = prev.windows[definition.id];
    if (!existing) {
      windows[definition.id] = defaults.windows[definition.id];
      changed = true;
      return;
    }
    const normalized = normalizeDialogState(existing.size, existing.position, viewport, {
      enforceTopLeftMargin: existing.displayMode === 'normal',
      clampSizeToViewport: existing.displayMode !== 'full-screen',
    });
    if (
      normalized.position.x !== existing.position.x
      || normalized.position.y !== existing.position.y
      || normalized.size.width !== existing.size.width
      || normalized.size.height !== existing.size.height
    ) {
      changed = true;
    }
    const iconPosition = existing.iconPosition ?? defaults.windows[definition.id]?.iconPosition;
    if (!existing.iconPosition && iconPosition) {
      changed = true;
    }
    windows[definition.id] = {
      ...existing,
      position: normalized.position,
      size: normalized.size,
      iconPosition,
    };
  });

  const order = prev.order.filter((id) => windows[id]);
  defaults.order.forEach((id) => {
    if (!order.includes(id)) {
      order.push(id);
      changed = true;
    }
  });

  const next = { version: STORAGE_VERSION, windows, order };
  return changed ? next : prev;
}

export function loadLayout(
  storageKey: string,
  definitions: MapDialogDefinitionBase[],
  iconPlacement?: ModelessIconPlacement,
): MapDialogLayout {
  const viewport = getViewportSize();
  const fallback = buildDefaultLayout(definitions, viewport, iconPlacement);

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as MapDialogLayout | null;
    if (!parsed || parsed.version !== STORAGE_VERSION) return fallback;
    return mergeLayout(parsed, definitions, iconPlacement);
  } catch (error) {
    console.warn('[ModelessDialogManager] Failed to load persisted layout', error);
    return fallback;
  }
}

export function persistLayout(storageKey: string, layout: MapDialogLayout) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(layout));
  } catch (error) {
    console.warn('[ModelessDialogManager] Failed to persist layout', error);
  }
}
