import { useDialogUrlSync, getPeerDialogPosition, getPeerDialogSize, getPeerDisplayMode, setPeerDialogPosition, setPeerDialogSize, setPeerDisplayMode, type PeerDisplayMode } from '@hierarchidb/plugin-base';
import {
  normalizeDialogState,
  getPresetSize,
  initialPosition,
  getViewportSize,
  FRAME_CONSTANTS,
  sizesEqual,
  positionsEqual,
} from '@hierarchidb/ui-dialog';
import type { DialogDisplayMode, MultiDialogPosition, MultiDialogSize } from '@hierarchidb/ui-dialog';
import type { NodeId } from '@hierarchidb/common-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { clampIndex, DEFAULT_POSITION, DEFAULT_SIZE } from '../controller/dialog-layout.js';

interface Params {
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  initialStep: number;
}

export function useDialogFrameState({
  nodeType,
  nodeId,
  initialStep,
}: Params): {
  activeStepIndex: number;
  setActiveStepIndex: (value: number) => void;
  setUrlStep: (next: number) => void;
  displayMode: DialogDisplayMode;
  dialogSize: MultiDialogSize;
  dialogPosition: MultiDialogPosition;
  transitionDisplayMode: (mode: DialogDisplayMode) => Promise<void>;
  handleSizeChange: (next?: MultiDialogSize) => void;
  handlePositionChange: (next?: MultiDialogPosition) => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
} {
  const {
    step: urlStep,
    setStep: setUrlStep,
    mode: urlMode,
    setMode: setUrlMode,
  } = useDialogUrlSync({
    defaults: { step: initialStep, mode: 'normal' },
    debounce: { map: 0 },
    history: { step: 'replace' },
  });

  const [activeStepIndex, setActiveStepIndex] = useState(initialStep);
  useEffect(() => {
    if (typeof urlStep === 'number') {
      setActiveStepIndex(clampIndex(urlStep, Number.POSITIVE_INFINITY));
    }
  }, [urlStep]);

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(DEFAULT_SIZE);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(DEFAULT_POSITION);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);
  const positionPersistTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dm, pos, sz] = await Promise.all([
          getPeerDisplayMode(nodeType, String(nodeId)),
          getPeerDialogPosition(nodeType, String(nodeId)),
          getPeerDialogSize(nodeType, String(nodeId)),
        ]);
        if (!mounted) return;
        if (dm) {
          setDisplayModeState(dm as DialogDisplayMode);
          setUrlMode(dm === 'full-screen' ? 'full' : 'normal');
        }
        if (pos) {
          setDialogPosition(pos);
          dialogPositionRef.current = pos;
        }
        if (sz) {
          setDialogSize(sz);
          dialogSizeRef.current = sz;
        }
      } catch (err) {
        console.warn('[PluginDialogShell] restore frame state failed', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [nodeType, nodeId, setUrlMode]);

  const persistDisplayMode = useCallback(
    (value: DialogDisplayMode) => {
      setDisplayModeState(value);
      setPeerDisplayMode(nodeType, String(nodeId), value as PeerDisplayMode).catch(() => void 0);
      setUrlMode(value === 'full-screen' ? 'full' : 'normal');
    },
    [nodeType, nodeId, setUrlMode]
  );

  useEffect(
    () => () => {
      if (positionPersistTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(positionPersistTimeoutRef.current);
        positionPersistTimeoutRef.current = null;
      }
    },
    []
  );

  const persistPosition = useCallback(
    (next: MultiDialogPosition) => {
      setDialogPosition(next);
      dialogPositionRef.current = next;

      if (typeof window !== 'undefined') {
        if (positionPersistTimeoutRef.current !== null) {
          window.clearTimeout(positionPersistTimeoutRef.current);
        }
        positionPersistTimeoutRef.current = window.setTimeout(() => {
          positionPersistTimeoutRef.current = null;
          setPeerDialogPosition(nodeType, String(nodeId), next).catch(() => void 0);
        }, 16); // ~1 frame debounce
      } else {
        setPeerDialogPosition(nodeType, String(nodeId), next).catch(() => void 0);
      }
    },
    [nodeType, nodeId]
  );

  const persistSize = useCallback(
    (next: MultiDialogSize) => {
      setDialogSize(next);
      dialogSizeRef.current = next;
      setPeerDialogSize(nodeType, String(nodeId), next).catch(() => void 0);
    },
    [nodeType, nodeId]
  );

  const transitionDisplayMode = useCallback(
    async (mode: DialogDisplayMode) => {
      const viewport = getViewportSize();

      const applyNormalizedState = (size: MultiDialogSize, position: MultiDialogPosition) => {
        dialogSizeRef.current = size;
        dialogPositionRef.current = position;
        persistSize(size);
        persistPosition(position);
      };

      if (mode === 'full-screen') {
        const fullSize: MultiDialogSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        applyNormalizedState(fullSize, { x: 0, y: 0 });
      } else if (mode === 'maximize') {
        const size = getPresetSize('maximize', viewport);
        const position: MultiDialogPosition = {
          x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        };
        const normalized = normalizeDialogState(size, position, viewport, {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      } else {
        const size = getPresetSize('normal', viewport);
        const position = initialPosition(size, viewport);
        const normalized = normalizeDialogState(size, position, viewport, {
          enforceTopLeftMargin: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      }

      setDisplayModeState(mode);
      persistDisplayMode(mode);
    },
    [persistDisplayMode, persistPosition, persistSize]
  );

  useEffect(() => {
    const modeKey = urlMode as string;
    if (modeKey === 'full') {
      void transitionDisplayMode('full-screen');
    } else if (displayMode === 'full-screen' && modeKey !== 'full') {
      void transitionDisplayMode('normal');
    }
  }, [urlMode, displayMode, transitionDisplayMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;

    const normalize = () => {
      rafId = null;
      const viewport = getViewportSize();
      let targetSize = dialogSizeRef.current;
      let targetPosition = dialogPositionRef.current;
      let options = {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      };

      if (displayMode === 'full-screen') {
        targetSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        targetPosition = { x: 0, y: 0 };
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: false,
        };
      } else if (displayMode === 'maximize') {
        targetSize = getPresetSize('maximize', viewport);
        targetPosition = {
          x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        };
        options = {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        };
      }

      const normalized = normalizeDialogState(targetSize, targetPosition, viewport, options);
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        dialogSizeRef.current = normalized.size;
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        dialogPositionRef.current = normalized.position;
        persistPosition(normalized.position);
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(normalize);
    };

    window.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      window.removeEventListener('resize', schedule);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [displayMode, persistPosition, persistSize]);

  const handleSizeChange = useCallback(
    (next?: MultiDialogSize) => {
      if (!next) return;
      const viewport = getViewportSize();
      const normalized = normalizeDialogState(next, dialogPositionRef.current, viewport, {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        persistPosition(normalized.position);
      }
    },
    [displayMode, persistPosition, persistSize]
  );

  const handlePositionChange = useCallback(
    (next?: MultiDialogPosition) => {
      if (!next) return;
      const viewport = getViewportSize();
      const normalized = normalizeDialogState(dialogSizeRef.current, next, viewport, {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        persistPosition(normalized.position);
      }
    },
    [displayMode, persistPosition, persistSize]
  );

  return {
    activeStepIndex,
    setActiveStepIndex,
    setUrlStep,
    displayMode,
    dialogSize,
    dialogPosition,
    transitionDisplayMode,
    handleSizeChange,
    handlePositionChange,
    dialogRef,
  };
}
