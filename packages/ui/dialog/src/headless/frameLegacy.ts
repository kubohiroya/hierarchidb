import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type {
  DialogDisplayMode,
  MultiDialogPosition,
  MultiDialogSize,
} from './types.js';

export const FRAME_CONSTANTS = {
  MIN_DIALOG_WIDTH: 560,
  MIN_DIALOG_HEIGHT: 360,
  NON_STANDARD_MARGIN: 24,
} as const;

export function getViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

export function getPresetSize(
  mode: DialogDisplayMode,
  viewport: { width: number; height: number },
): MultiDialogSize {
  switch (mode) {
    case 'maximize':
      return {
        width: Math.max(viewport.width - FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height - FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };
    case 'full-screen':
      return {
        width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };
    case 'normal':
    default: {
      const targetWidth = viewport.width * 0.72;
      const targetHeight = viewport.height * 0.66;
      return {
        width: Math.min(Math.max(targetWidth, FRAME_CONSTANTS.MIN_DIALOG_WIDTH), viewport.width),
        height: Math.min(Math.max(targetHeight, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT), viewport.height),
      };
    }
  }
}

export function normalizeDialogState(
  size: MultiDialogSize,
  position: MultiDialogPosition,
  viewport: { width: number; height: number },
  options: {
    enforceTopLeftMargin?: boolean;
    minPosition?: number;
    clampSizeToViewport?: boolean;
  } = {},
): { size: MultiDialogSize; position: MultiDialogPosition } {
  const {
    enforceTopLeftMargin = true,
    minPosition = 0,
    clampSizeToViewport = true,
  } = options;

  const minWidth = Math.min(FRAME_CONSTANTS.MIN_DIALOG_WIDTH, viewport.width);
  const minHeight = Math.min(FRAME_CONSTANTS.MIN_DIALOG_HEIGHT, viewport.height);

  let normalizedWidth = Math.max(size.width, minWidth);
  let normalizedHeight = Math.max(size.height, minHeight);

  if (clampSizeToViewport) {
    normalizedWidth = Math.min(normalizedWidth, viewport.width);
    normalizedHeight = Math.min(normalizedHeight, viewport.height);
  }

  const minX = enforceTopLeftMargin ? 0 : minPosition;
  const minY = enforceTopLeftMargin ? 0 : minPosition;
  const maxX = clampSizeToViewport
    ? Math.max(viewport.width - FRAME_CONSTANTS.NON_STANDARD_MARGIN, minX)
    : Number.POSITIVE_INFINITY;
  const maxY = clampSizeToViewport
    ? Math.max(viewport.height - FRAME_CONSTANTS.NON_STANDARD_MARGIN, minY)
    : Number.POSITIVE_INFINITY;

  const normalizedPosition: MultiDialogPosition = {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };

  return {
    size: { width: normalizedWidth, height: normalizedHeight },
    position: normalizedPosition,
  };
}

export function initialPosition(
  size: MultiDialogSize,
  viewport: { width: number; height: number },
): MultiDialogPosition {
  const centeredX = Math.max((viewport.width - size.width) / 2, 0);
  const centeredY = Math.max((viewport.height - size.height) / 2, 0);
  return { x: centeredX, y: centeredY };
}

export function sizesEqual(a: MultiDialogSize, b: MultiDialogSize): boolean {
  return Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

export function positionsEqual(a: MultiDialogPosition, b: MultiDialogPosition): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

interface TransitionOptions {
  displayMode: DialogDisplayMode;
  setDisplayMode: (mode: DialogDisplayMode) => void;
  sizeRef: MutableRefObject<MultiDialogSize>;
  positionRef: MutableRefObject<MultiDialogPosition>;
  onSizeChange?: (size: MultiDialogSize) => void;
  onPositionChange?: (position: MultiDialogPosition) => void;
  viewportResolver?: () => { width: number; height: number };
  nonStandardMargin?: number;
}

export function useDialogDisplayTransition(options: TransitionOptions) {
  const {
    displayMode: _displayMode,
    setDisplayMode,
    sizeRef,
    positionRef,
    onSizeChange,
    onPositionChange,
    viewportResolver = getViewportSize,
    nonStandardMargin = FRAME_CONSTANTS.NON_STANDARD_MARGIN,
  } = options;

  const handleDisplayModeChange = useCallback(async (mode: DialogDisplayMode) => {
    const viewport = viewportResolver();

    const apply = (size: MultiDialogSize, position: MultiDialogPosition) => {
      sizeRef.current = size;
      positionRef.current = position;
      onSizeChange?.(size);
      onPositionChange?.(position);
    };

    if (mode === 'full-screen') {
      const size: MultiDialogSize = {
        width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };
      apply(size, { x: 0, y: 0 });
    } else if (mode === 'maximize') {
      const preset = getPresetSize('maximize', viewport);
      const normalized = normalizeDialogState(preset, { x: nonStandardMargin, y: nonStandardMargin }, viewport, {
        enforceTopLeftMargin: false,
        minPosition: nonStandardMargin,
        clampSizeToViewport: true,
      });
      apply(normalized.size, normalized.position);
    } else {
      const preset = getPresetSize('normal', viewport);
      const normalized = normalizeDialogState(preset, initialPosition(preset, viewport), viewport, {
        enforceTopLeftMargin: true,
      });
      apply(normalized.size, normalized.position);
    }

    setDisplayMode(mode);
  }, [nonStandardMargin, onPositionChange, onSizeChange, positionRef, setDisplayMode, sizeRef, viewportResolver]);

  return { handleDisplayModeChange };
}
