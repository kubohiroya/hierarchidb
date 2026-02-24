/**
 * @file modelessDialogLayout.ts
 * @description Modeless dialog layout persistence helpers.
 */

import type { DialogDisplayMode, DialogPosition, DialogSize } from '@hierarchidb/tree-api';
import {
  getPresetSize,
  getViewportSize,
  initialPosition,
  normalizeDialogState,
} from '@hierarchidb/ui-dialog';

export const STORAGE_VERSION = 2;
export const STORAGE_KEY_PREFIX = 'hdb.map.dialogs';
export const WINDOW_OFFSET_STEP = 28;
export const RESTORE_DISTANCE_THRESHOLD = 32;
export const RESTORE_MAX_ATTEMPTS = 32;

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

type StoredDialogMode = DialogDisplayMode | 'closed';

type StoredPosition = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

type StoredDialogRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type StoredDialogWindow = {
  mode: StoredDialogMode;
  dialog: StoredDialogRect;
  iconPosition?: StoredPosition;
  lastNormal?: StoredDialogRect;
  isMinimized?: boolean;
};

type StoredDialogLayout = {
  version: 2;
  windows: Record<string, StoredDialogWindow>;
  order: string[];
};

type LegacyDialogLayout = {
  version: 1;
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
  placement?: ModelessIconPlacement
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

function toStoredPosition(
  position: DialogPosition,
  viewport: { width: number; height: number }
): StoredPosition {
  const right = Math.max(viewport.width - position.x - ICON_BOX_SIZE, 0);
  const bottom = Math.max(viewport.height - position.y - ICON_BOX_SIZE, 0);
  return { bottom, right };
}

function fromStoredPosition(
  position: StoredPosition,
  viewport: { width: number; height: number }
): DialogPosition {
  const left =
    position.left ??
    (position.right != null ? Math.max(viewport.width - position.right - ICON_BOX_SIZE, 0) : 0);
  const top =
    position.top ??
    (position.bottom != null ? Math.max(viewport.height - position.bottom - ICON_BOX_SIZE, 0) : 0);
  return { x: left, y: top };
}

function toStoredRect(position: DialogPosition, size: DialogSize): StoredDialogRect {
  return {
    top: position.y,
    left: position.x,
    width: size.width,
    height: size.height,
  };
}

function fromStoredRect(rect: StoredDialogRect): { position: DialogPosition; size: DialogSize } {
  return {
    position: { x: rect.left, y: rect.top },
    size: { width: rect.width, height: rect.height },
  };
}

function isStoredDialogLayout(value: unknown): value is StoredDialogLayout {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as StoredDialogLayout;
  return (
    candidate.version === 2 &&
    typeof candidate.windows === 'object' &&
    Array.isArray(candidate.order)
  );
}

function isLegacyDialogLayout(value: unknown): value is LegacyDialogLayout {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as LegacyDialogLayout;
  return (
    candidate.version === 1 &&
    typeof candidate.windows === 'object' &&
    Array.isArray(candidate.order)
  );
}

function toWindowState(
  id: string,
  stored: StoredDialogWindow,
  viewport: { width: number; height: number }
): MapDialogWindowState {
  const { position, size } = fromStoredRect(stored.dialog);
  const lastNormal = stored.lastNormal ? fromStoredRect(stored.lastNormal) : undefined;
  const displayMode = stored.mode === 'closed' ? 'normal' : stored.mode;
  return {
    id,
    position,
    size,
    displayMode,
    isVisible: stored.mode !== 'closed',
    isMinimized: stored.isMinimized ?? false,
    iconPosition: stored.iconPosition
      ? fromStoredPosition(stored.iconPosition, viewport)
      : undefined,
    lastNormalPosition: lastNormal?.position,
    lastNormalSize: lastNormal?.size,
  };
}

function toStoredWindow(
  windowState: MapDialogWindowState,
  viewport: { width: number; height: number }
): StoredDialogWindow {
  const dialog = toStoredRect(windowState.position, windowState.size);
  const lastNormal =
    windowState.lastNormalPosition && windowState.lastNormalSize
      ? toStoredRect(windowState.lastNormalPosition, windowState.lastNormalSize)
      : undefined;
  const mode: StoredDialogMode = windowState.isVisible ? windowState.displayMode : 'closed';
  return {
    mode,
    dialog,
    iconPosition: windowState.iconPosition
      ? toStoredPosition(windowState.iconPosition, viewport)
      : undefined,
    lastNormal,
    isMinimized: windowState.isMinimized,
  };
}

export function buildDefaultLayout(
  definitions: MapDialogDefinitionBase[],
  viewport: { width: number; height: number },
  iconPlacement?: ModelessIconPlacement
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
  viewport: { width: number; height: number } = getViewportSize()
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
  iconPlacement?: ModelessIconPlacement
): MapDialogLayout {
  const viewport = getViewportSize();
  const defaults = buildDefaultLayout(definitions, viewport, iconPlacement);
  let changed = false;

  const windows: Record<string, MapDialogWindowState> = {};

  definitions.forEach((definition) => {
    const existing = prev.windows[definition.id];
    if (!existing) {
      const fallback = defaults.windows[definition.id];
      if (fallback) {
        windows[definition.id] = fallback;
        changed = true;
      }
      changed = true;
      return;
    }
    const normalized = normalizeDialogState(existing.size, existing.position, viewport, {
      enforceTopLeftMargin: existing.displayMode === 'normal',
      clampSizeToViewport: existing.displayMode !== 'full-screen',
    });
    if (
      normalized.position.x !== existing.position.x ||
      normalized.position.y !== existing.position.y ||
      normalized.size.width !== existing.size.width ||
      normalized.size.height !== existing.size.height
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

export function resolveRestorePosition({
  layout,
  windowId,
  windowState,
  viewport = getViewportSize(),
  distanceThreshold = RESTORE_DISTANCE_THRESHOLD,
  maxAttempts = RESTORE_MAX_ATTEMPTS,
}: {
  layout: MapDialogLayout;
  windowId: string;
  windowState: MapDialogWindowState;
  viewport?: { width: number; height: number };
  distanceThreshold?: number;
  maxAttempts?: number;
}): DialogPosition {
  if (windowState.displayMode !== 'normal') return windowState.position;

  const size = windowState.lastNormalSize ?? windowState.size;
  const basePosition = windowState.lastNormalPosition ?? windowState.position;
  const others = Object.values(layout.windows)
    .filter((entry) => entry.id !== windowId && entry.isVisible)
    .map((entry) => entry.position);

  const isNear = (candidate: DialogPosition) =>
    others.some(
      (entry) => Math.hypot(entry.x - candidate.x, entry.y - candidate.y) <= distanceThreshold
    );

  const isRightOrBottom = (candidate: DialogPosition) =>
    candidate.x >= viewport.width * (2 / 3) || candidate.y >= viewport.height * (2 / 3);

  const randomTopLeft = () => {
    const maxX = Math.max(viewport.width * (2 / 3) - size.width, 0);
    const maxY = Math.max(viewport.height * (2 / 3) - size.height, 0);
    return {
      x: Math.round(Math.random() * maxX),
      y: Math.round(Math.random() * maxY),
    };
  };

  let candidate = { ...basePosition };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const normalized = normalizeDialogState(size, candidate, viewport, {
      enforceTopLeftMargin: true,
      clampSizeToViewport: true,
    });
    candidate = normalized.position;

    if (isRightOrBottom(candidate)) {
      candidate = randomTopLeft();
      if (!isNear(candidate)) return candidate;
      continue;
    }

    if (!isNear(candidate)) return candidate;

    candidate = {
      x: candidate.x + distanceThreshold,
      y: candidate.y + distanceThreshold,
    };
  }

  const fallback = normalizeDialogState(size, randomTopLeft(), viewport, {
    enforceTopLeftMargin: true,
    clampSizeToViewport: true,
  });
  return fallback.position;
}

export function loadLayout(
  storageKey: string,
  definitions: MapDialogDefinitionBase[],
  iconPlacement?: ModelessIconPlacement
): MapDialogLayout {
  const viewport = getViewportSize();
  const fallback = buildDefaultLayout(definitions, viewport, iconPlacement);

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed) return fallback;
    if (isStoredDialogLayout(parsed)) {
      const windows: Record<string, MapDialogWindowState> = {};
      Object.entries(parsed.windows).forEach(([id, windowState]) => {
        windows[id] = toWindowState(id, windowState, viewport);
      });
      return mergeLayout(
        { version: STORAGE_VERSION, windows, order: parsed.order },
        definitions,
        iconPlacement
      );
    }
    if (isLegacyDialogLayout(parsed)) {
      return mergeLayout({ ...parsed, version: STORAGE_VERSION }, definitions, iconPlacement);
    }
    return fallback;
  } catch (error) {
    console.warn('[ModelessDialogManager] Failed to load persisted layout', error);
    return fallback;
  }
}

export function persistLayout(storageKey: string, layout: MapDialogLayout) {
  if (typeof window === 'undefined') return;
  try {
    const viewport = getViewportSize();
    const windows: Record<string, StoredDialogWindow> = {};
    Object.entries(layout.windows).forEach(([id, windowState]) => {
      windows[id] = toStoredWindow(windowState, viewport);
    });
    const stored: StoredDialogLayout = {
      version: STORAGE_VERSION,
      windows,
      order: layout.order,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(stored));
  } catch (error) {
    console.warn('[ModelessDialogManager] Failed to persist layout', error);
  }
}
