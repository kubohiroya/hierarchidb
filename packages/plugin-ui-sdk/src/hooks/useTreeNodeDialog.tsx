import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { DialogDisplayMode, DialogPosition, DialogSize, NodeId, TreeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import {
  FRAME_CONSTANTS,
  getPresetSize,
  getViewportSize,
  initialPosition,
  normalizeDialogState,
  positionsEqual,
  sizesEqual,
  type StepNavigationEvent,
  type HeadlessDialogProps as HeadlessMultiStepDialogProps,
} from '@hierarchidb/ui-dialog';
import {
  createTreeNodeUpdaterActions,
  useTreeNodeUpdater,
  type UseTreeNodeUpdaterResult,
} from './useTreeNodeUpdater.js';
import type { TreeNodeUpdaterState } from './useTreeNodeUpdater.js';
import {
  useSingleSourceDialogAtom,
  type SingleSourceDialogAtomResult,
} from './useSingleSourceDialogAtom.js';

export interface DialogStepConfig {
  id: string;
  label: string;
  component: ReactNode;
  validate?: () => boolean;
}

import type { TreeNodeData } from '@hierarchidb/common-types';

export interface DialogStepFactoryArgs<TPayload extends TreeNodeData> {
  data: TPayload;
  metadata?: TreeNodeMetadata;
  persistBasicInfo: (meta: TreeNodeMetadata) => void;
  updatePayload: (patch: Partial<TPayload>) => void;
  dialogRef: RefObject<HTMLDivElement>;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
}

export interface UseTreeNodeDialogOptions<TPayload extends TreeNodeData> {
  open: boolean;
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  onClose: () => void;
  onSave: (data: TreeNodeMetadata, nodeId?: NodeId) => Promise<void>;
  initialDraftData?: TPayload;
  initialDraftMetadata?: TreeNodeMetadata;
  buildSteps: (args: DialogStepFactoryArgs<TPayload>) => DialogStepConfig[];
  useSingleSource?: boolean;
}

interface DialogViewState {
  size: DialogSize;
  position: DialogPosition;
  displayMode: DialogDisplayMode;
  activeStepIndex: number;
  isSaving: boolean;
  multiStepState: unknown;
}

interface DialogViewStatePatchInput {
  reset?: boolean;
  patch: Partial<DialogViewState>;
}

interface UseDialogViewStateOptions {
  initialSize?: DialogSize;
  initialPosition?: DialogPosition;
  initialDisplayMode?: DialogDisplayMode;
  initialActiveStepIndex?: number;
}

interface UseDialogViewStateResult {
  dialogViewState: DialogViewState;
  updateDialogViewState: (input: DialogViewStatePatchInput) => void;
  resetDialogViewState: () => void;
}

const DEFAULT_SIZE: DialogSize = { width: 960, height: 640 };
const DEFAULT_POSITION: DialogPosition = { x: 64, y: 64 };
const DEFAULT_DISPLAY_MODE: DialogDisplayMode = 'normal';

const useDialogViewState = (options: UseDialogViewStateOptions = {}): UseDialogViewStateResult => {
  const {
    initialSize = DEFAULT_SIZE,
    initialPosition = DEFAULT_POSITION,
    initialDisplayMode = DEFAULT_DISPLAY_MODE,
    initialActiveStepIndex = 0,
  } = options;

  const initialStateRef = useRef<DialogViewState>({
    size: initialSize,
    position: initialPosition,
    displayMode: initialDisplayMode,
    activeStepIndex: initialActiveStepIndex,
    isSaving: false,
    multiStepState: null,
  });

  const [dialogViewState, setDialogViewState] = useState<DialogViewState>(initialStateRef.current);

  const resetDialogViewState = useCallback(() => {
    setDialogViewState(initialStateRef.current);
  }, []);

  const updateDialogViewState = useCallback((input: DialogViewStatePatchInput) => {
    setDialogViewState((prev: DialogViewState) => {
      const base = input.reset ? initialStateRef.current : prev;
      return { ...base, ...input.patch };
    });
  }, []);

  return useMemo(
    () => ({
      dialogViewState,
      updateDialogViewState,
      resetDialogViewState,
    }),
    [dialogViewState, updateDialogViewState, resetDialogViewState]
  );
};

const defaultDialogState = () => {
  const viewport = getViewportSize();
  const size = getPresetSize('normal', viewport);
  const position = initialPosition(size, viewport);
  return { size, position };
};

export function useTreeNodeDialog<TPayload extends TreeNodeData>(
  options: UseTreeNodeDialogOptions<TPayload>
): {
  frameStyle: CSSProperties;
  dialogRef: RefObject<HTMLDivElement>;
  headlessProps: HeadlessMultiStepDialogProps<TPayload>;
  data: TPayload;
  metadata?: TreeNodeMetadata;
  workerClient: WorkerClientRef | null;
  persistBasicInfo: (meta: TreeNodeMetadata) => void;
  updatePayload: (patch: Partial<TPayload>) => void;
  updateMetadata: (patch: Partial<TreeNodeMetadata>, base?: TreeNodeMetadata) => void;
  treeNodeUpdater: UseTreeNodeUpdaterResult<TPayload>['treeNodeUpdater'];
  singleSource?: SingleSourceDialogAtomResult<TPayload>;
  saveDraft: () => Promise<NodeId | undefined>;
  discardDraft: () => Promise<void>;
  dialogViewState: DialogViewState;
  updateDialogViewState: (input: DialogViewStatePatchInput) => void;
  resetDialogViewState: () => void;
} {
  const {
    open,
    mode,
    nodeType,
    nodeId,
    parentId,
    treeId,
    onClose,
    onSave,
    initialDraftData,
    initialDraftMetadata,
    buildSteps,
    useSingleSource = false,
  } = options;

  const workerClient = useMemo<WorkerClientRef | null>(() => {
    try {
      const hook = getWorkerClientHook<WorkerClientRef | null>();
      return hook();
    } catch {
      return null;
    }
  }, []);

  const { size: initialSize, position: initialPositionValue } = useMemo(defaultDialogState, []);

  const { dialogViewState, updateDialogViewState, resetDialogViewState } = useDialogViewState({
    initialSize,
    initialPosition: initialPositionValue,
    initialDisplayMode: 'normal',
    initialActiveStepIndex: 0,
  });

  const singleSource = useSingleSourceDialogAtom<TPayload>({
    mode,
    nodeType,
    nodeId,
    parentId,
    treeId,
    workerClient,
    initialDraftData,
    initialDraftMetadata,
  });

  const fallbackUpdater = useTreeNodeUpdater<TPayload>({
    mode,
    nodeType,
    nodeId,
    parentId,
    treeId,
    workerClient,
    initialDraftData,
    initialDraftMetadata,
  });

  const activeSingle = useSingleSource ? singleSource : null;
  const activeFallback = useSingleSource ? null : fallbackUpdater;

  const treeNodeUpdater = activeSingle?.treeNodeUpdater ?? activeFallback?.treeNodeUpdater ?? null;
  const updateTreeNodeUpdater =
    useMemo(()=>activeSingle?.updateTreeNodeUpdater ?? activeFallback?.updateTreeNodeUpdater ?? (() => {}),[activeFallback?.updateTreeNodeUpdater, activeSingle?.updateTreeNodeUpdater]);
  const commitTreeNodeUpdater =
    useMemo(()=>activeSingle?.commit ?? activeFallback?.commitTreeNodeUpdater ?? (async () => undefined), [activeFallback?.commitTreeNodeUpdater, activeSingle?.commit]);
  const discardDraft = useMemo(()=>activeSingle?.discard ?? activeFallback?.discardDraft ?? (async () => {}),[activeFallback?.discardDraft, activeSingle?.discard]);
  const saveDraft = useCallback(async () => {
    if (!treeNodeUpdater) throw new Error('No draft to save');
    return commitTreeNodeUpdater?.('save-draft', treeNodeUpdater);
  }, [commitTreeNodeUpdater, treeNodeUpdater]);

  const { size: dialogSize, position: dialogPosition, displayMode, activeStepIndex, isSaving } = dialogViewState;
  const dialogRef = useRef<HTMLDivElement>(null!);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);
  const restoredDialogStateForNodeRef = useRef<NodeId | null>(null);

  const data = useMemo<TPayload>(() => (treeNodeUpdater?.draftData ?? ({} as TreeNodeData)) as TPayload, [
    treeNodeUpdater?.draftData,
  ]);

  const { updatePayload, updateMetadata } = useMemo(() => {
    if (activeSingle) {
      return {
        updatePayload: (patch: Partial<TPayload>, base?: TPayload) => {
          activeSingle.setDraft((prev) => ({ ...(base ?? prev), ...patch }));
        },
        updateMetadata: (patch: Partial<TreeNodeMetadata>, base?: TreeNodeMetadata) => {
          activeSingle.setMetadata((prev) => ({ ...(base ?? prev), ...patch }));
        },
      };
    }
    return createTreeNodeUpdaterActions<TPayload>(updateTreeNodeUpdater);
  }, [activeSingle, updateTreeNodeUpdater]);

  const persistBasicInfo = useCallback(
    (meta: TreeNodeMetadata) => {
      const baseMeta = treeNodeUpdater?.draftMetadata;
      updateMetadata(
        {
          name: meta.name ?? '',
          description: meta.description ?? '',
          tags: meta.tags ?? [],
        },
        baseMeta ?? { name: '', description: '', tags: [] }
      );
    },
    [treeNodeUpdater?.draftMetadata, updateMetadata]
  );

  const handleUpdate = useCallback(
    (patch: Partial<TPayload>) => {
      const basePayload = (treeNodeUpdater?.draftData ?? {}) as TPayload;
      updatePayload(patch, basePayload);
    },
    [treeNodeUpdater?.draftData, updatePayload]
  );

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    updateDialogViewState({ patch: { isSaving: true } });
      const baseMeta = treeNodeUpdater?.draftMetadata ?? { name: '', description: '', tags: [] };
    try {
      if (!treeNodeUpdater) throw new Error('No draft to save');
      const targetId = treeNodeUpdater.treeNodeId ?? nodeId;
      const payload: TreeNodeUpdaterState<TPayload> = {
        ...treeNodeUpdater,
        treeNodeId: targetId,
        draftData: nodeType === 'folder' ? null : (treeNodeUpdater.draftData ?? ({} as TreeNodeData)) as TPayload,
        draftMetadata: {
          ...(treeNodeUpdater.draftMetadata ?? {}),
          name: baseMeta.name ?? '',
          description: baseMeta.description ?? '',
          tags: baseMeta.tags ?? [],
        },
        dialogUIState: treeNodeUpdater.dialogUIState,
      };
      if (activeSingle) {
        activeSingle.updateTreeNodeUpdater?.(payload);
      }
      const savedId = activeSingle
        ? await activeSingle.commit()
        : await commitTreeNodeUpdater('save', payload);
      await onSave(
        {
          name: baseMeta.name ?? '',
          description: baseMeta.description ?? '',
          tags: baseMeta.tags ?? [],
        },
        (savedId ?? treeNodeUpdater?.treeNodeId ?? nodeId ?? '') as NodeId
      );
      onClose();
    } finally {
      updateDialogViewState({ patch: { isSaving: false } });
    }
  }, [isSaving, updateDialogViewState, treeNodeUpdater?.draftMetadata, treeNodeUpdater?.treeNodeId, nodeType, activeSingle, commitTreeNodeUpdater, onSave, nodeId, onClose]);

  const handleDiscard = useCallback(() => {
    const action = activeSingle ? activeSingle.discard : discardDraft;
    void action().catch(() => {});
    onClose();
  }, [discardDraft, onClose, activeSingle]);

  const metadata = treeNodeUpdater?.draftMetadata ?? undefined;

  const steps = useMemo(
    () =>
      buildSteps({
        data,
        metadata,
        persistBasicInfo,
        updatePayload: handleUpdate,
        dialogRef,
        mode,
        nodeId,
        parentId,
      }),
    [buildSteps, data, handleUpdate, metadata, mode, nodeId, parentId, persistBasicInfo]
  );

  const enabledStepIndices = useMemo(
    () =>
      steps
        .map((step, idx) => ((step.validate ? step.validate() : true) ? idx : -1))
        .filter((idx) => idx >= 0),
    [steps]
  );

  const handleNavigation = useCallback(
    (event: StepNavigationEvent) => {
      switch (event.type) {
        case 'direct':
          updateDialogViewState({ patch: { activeStepIndex: event.targetIndex } });
          break;
        case 'next':
          updateDialogViewState({
            patch: { activeStepIndex: Math.min(activeStepIndex + 1, steps.length - 1) },
          });
          break;
        case 'back':
          updateDialogViewState({
            patch: { activeStepIndex: Math.max(activeStepIndex - 1, 0) },
          });
          break;
      }
    },
    [activeStepIndex, steps.length, updateDialogViewState]
  );

  const handleSizeChange = useCallback(
    (next?: DialogSize) => {
      if (!next) return;
      const normalized = normalizeDialogState(next, dialogPositionRef.current, getViewportSize(), {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      if (
        !sizesEqual(dialogSizeRef.current, normalized.size) ||
        !positionsEqual(dialogPositionRef.current, normalized.position)
      ) {
        dialogSizeRef.current = normalized.size;
        dialogPositionRef.current = normalized.position;
        updateDialogViewState({ patch: { size: normalized.size, position: normalized.position } });
      }
    },
    [displayMode, updateDialogViewState]
  );

  const handlePositionChange = useCallback(
    (next?: DialogPosition) => {
      if (!next) return;
      const normalized = normalizeDialogState(dialogSizeRef.current, next, getViewportSize(), {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      if (
        !sizesEqual(dialogSizeRef.current, normalized.size) ||
        !positionsEqual(dialogPositionRef.current, normalized.position)
      ) {
        dialogSizeRef.current = normalized.size;
        dialogPositionRef.current = normalized.position;
        updateDialogViewState({ patch: { size: normalized.size, position: normalized.position } });
      }
    },
    [displayMode, updateDialogViewState]
  );

  useEffect(() => {
    // Reset restoration guard when dialog closes to allow re-apply on next open.
    if (!open) {
      restoredDialogStateForNodeRef.current = null;
      return;
    }

    const persisted = treeNodeUpdater?.dialogUIState ?? null;
    const targetId = treeNodeUpdater?.treeNodeId ?? nodeId ?? null;
    if (!persisted || !targetId) return;
    if (restoredDialogStateForNodeRef.current === targetId) return;

    const windowState = persisted.dialogWindow ?? null;
    const progressState = persisted.dialogProgress ?? null;
    const targetDisplayMode = windowState?.mode ?? displayMode;

    const normalized = normalizeDialogState(
      windowState?.size ?? dialogSizeRef.current,
      windowState?.position ?? dialogPositionRef.current,
      getViewportSize(),
      {
        enforceTopLeftMargin: targetDisplayMode === 'normal',
        minPosition: targetDisplayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      }
    );

    dialogSizeRef.current = normalized.size;
    dialogPositionRef.current = normalized.position;

    updateDialogViewState({
      reset: true,
      patch: {
        size: normalized.size,
        position: normalized.position,
        displayMode: targetDisplayMode,
        activeStepIndex:
          typeof progressState?.activeStepIndex === 'number'
            ? progressState.activeStepIndex
            : dialogViewState.activeStepIndex,
      },
    });

    restoredDialogStateForNodeRef.current = targetId;
  }, [
    displayMode,
    dialogViewState.activeStepIndex,
    nodeId,
    open,
    treeNodeUpdater?.dialogUIState,
    treeNodeUpdater?.treeNodeId,
    updateDialogViewState,
  ]);

  const isDirty =
    mode === 'create'
      ? true
      : singleSource?.hasUnsavedChanges ?? fallbackUpdater?.hasUnsavedChanges ?? false;

  const headlessProps: HeadlessMultiStepDialogProps<TPayload> = {
    open,
    stepComponents: steps.map((step) => ({
      id: step.id,
      label: step.label,
      component: () => step.component,
    })),
    stepData: data,
    onStepDataChange: () => {},
    activeStepIndex,
    onStepNavigate: handleNavigation,
    enabledStepIndices,
    validatedStepIndices: enabledStepIndices,
    committableStepIndices: [steps.length - 1],
    invalidMessageMap: {},
    onRequestClose: handleDiscard,
    onRequestCommit: handleSave,
    isDirty,
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    displayMode,
    onDisplayModeChange: (nextMode: DialogDisplayMode) =>
      updateDialogViewState({ patch: { displayMode: nextMode } }),
  };

  const fullScreen = displayMode === 'full-screen';
  const frameStyle: React.CSSProperties = {
    width: fullScreen ? '100%' : `${dialogSize.width}px`,
    maxWidth: fullScreen ? '100%' : 'min(calc(100vw - 48px), 1280px)',
    height: fullScreen ? '100%' : `${dialogSize.height}px`,
    maxHeight: fullScreen ? '100%' : 'calc(100vh - 48px)',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: fullScreen ? 0 : 12,
    boxShadow: fullScreen ? 'none' : '0 22px 80px rgba(10, 14, 36, 0.38)',
    overflow: 'hidden',
    backgroundColor: '#fff',
  };

  return {
    frameStyle,
    dialogRef,
    headlessProps,
    data,
    metadata,
    workerClient,
    persistBasicInfo,
    updatePayload: handleUpdate,
    updateMetadata,
    treeNodeUpdater,
    singleSource: singleSource ?? undefined,
    saveDraft,
    discardDraft,
    dialogViewState,
    updateDialogViewState,
    resetDialogViewState,
  };
}

// Exported for consumers that only need view state management (frame/layout persistence).
export { useDialogViewState };
