import {
  FRAME_CONSTANTS,
  getPresetSize,
  getViewportSize,
  initialPosition,
  normalizeDialogState,
  positionsEqual,
  sizesEqual,
  type DialogDisplayMode,
  type MultiDialogPosition,
  type MultiDialogSize,
} from '@hierarchidb/ui-dialog';
import {
  getPeerDialogPosition,
  getPeerDialogSize,
  getPeerDisplayMode,
  setPeerDialogPosition,
  setPeerDialogSize,
  setPeerDisplayMode,
} from '@hierarchidb/plugin-base';
import type { PeerDisplayMode } from '@hierarchidb/plugin-base';

export const DEFAULT_SIZE: MultiDialogSize = { width: 960, height: 640 };
export const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;
export const DEFAULT_POSITION: MultiDialogPosition = initialPosition(DEFAULT_SIZE, DEFAULT_VIEWPORT);

export const clampIndex = (index: number, length: number) => {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
};

export const getInitialDialogState = () => {
  const viewport = getViewportSize();
  const size = getPresetSize('normal', viewport);
  const position = initialPosition(size, viewport);
  return { size, position };
};

export const hydratePeerDialogState = async ({
  nodeType,
  nodeId,
}: {
  nodeType: string;
  nodeId: string;
}): Promise<{
  size: MultiDialogSize;
  position: MultiDialogPosition;
  displayMode: PeerDisplayMode;
}> => {
  const viewportSize = getViewportSize();
  const safePosition = initialPosition(DEFAULT_SIZE, viewportSize);
  const peerSize = (await getPeerDialogSize(nodeType, nodeId)) ?? DEFAULT_SIZE;
  const peerPosition = (await getPeerDialogPosition(nodeType, nodeId)) ?? safePosition;
  const peerDisplayMode = (await getPeerDisplayMode(nodeType, nodeId)) ?? 'normal';
  return {
    size: normalizeDialogState(
      peerSize,
      peerPosition,
      viewportSize,
      {
        enforceTopLeftMargin: true,
        minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      }
    ).size,
    position: peerPosition,
    displayMode: peerDisplayMode,
  };
};

export const persistPeerDialogState = ({
  nodeType,
  nodeId,
  size,
  position,
  displayMode,
}: {
  nodeType: string;
  nodeId: string;
  size: MultiDialogSize;
  position: MultiDialogPosition;
  displayMode: DialogDisplayMode;
}): Promise<void> => 
  (async () => {
  await setPeerDialogSize(nodeType, nodeId, size);
  await setPeerDialogPosition(nodeType, nodeId, position);
  await setPeerDisplayMode(nodeType, nodeId, displayMode as PeerDisplayMode);
  })();

export const normalizeAndUpdateSize = ({
  nextSize,
  currentSize,
  dialogPositionRef,
  displayMode,
  setDialogSize,
  setDialogPosition,
}: {
  nextSize?: MultiDialogSize;
  currentSize: MultiDialogSize;
  dialogPositionRef: React.MutableRefObject<MultiDialogPosition>;
  displayMode: DialogDisplayMode;
  setDialogSize: (size: MultiDialogSize) => void;
  setDialogPosition: (pos: MultiDialogPosition) => void;
}) => {
  if (!nextSize) return;
  const normalized = normalizeDialogState(
    nextSize,
    dialogPositionRef.current,
    getViewportSize(),
    {
      enforceTopLeftMargin: displayMode === 'normal',
      minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    },
  );
  if (!sizesEqual(currentSize, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
    dialogPositionRef.current = normalized.position;
    setDialogSize(normalized.size);
    setDialogPosition(normalized.position);
  }
};

export const normalizeAndUpdatePosition = ({
  nextPos,
  dialogSizeRef,
  displayMode,
  setDialogSize,
  setDialogPosition,
}: {
  nextPos?: MultiDialogPosition;
  dialogSizeRef: React.MutableRefObject<MultiDialogSize>;
  displayMode: DialogDisplayMode;
  setDialogSize: (size: MultiDialogSize) => void;
  setDialogPosition: (pos: MultiDialogPosition) => void;
}) => {
  if (!nextPos) return;
  const normalized = normalizeDialogState(
    dialogSizeRef.current,
    nextPos,
    getViewportSize(),
    {
      enforceTopLeftMargin: displayMode === 'normal',
      minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    },
  );
  if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(nextPos, normalized.position)) {
    dialogSizeRef.current = normalized.size;
    setDialogSize(normalized.size);
    setDialogPosition(normalized.position);
  }
};
