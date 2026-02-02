import { useCallback, useEffect, useRef } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { CommitDraftMode, DialogProgressState, DialogUIState, TreeNodeData } from '@hierarchidb/tree-api';
import type { TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import type { StepNavigationEvent } from '@hierarchidb/ui-dialog';
import type { DialogActionInFlight } from '../types.js';

type UseStepNavigationArgs<TData extends TreeNodeData> = {
  activeStepIndex: number;
  stepsLength: number;
  setActiveStepIndex: (index: number) => void;
  setUrlStep: (index: number) => void;
  toPersistedStepIndex: (index: number) => number;
  runWithPending: (action: DialogActionInFlight, task: () => Promise<void>) => void;
  updateLocalDraft: () => Promise<void> | void;
  updateDialogUIState: (patch: Partial<DialogUIState>) => void;
  getPersistableDialogUIState: () => DialogUIState | null;
  commitTreeNodeUpdater?: (
    mode: CommitDraftMode,
    payload: TreeNodeUpdaterState<Partial<TData>>
  ) => Promise<NodeId>;
  nodeId: NodeId;
  nodeType: string;
  treeUpdaterTreeNodeId?: NodeId;
  treeUpdaterDraftMetadata: TreeNodeUpdaterState<Partial<TData>>['draftMetadata'] | null | undefined;
  localDraftDataRef: React.MutableRefObject<Partial<TData>>;
};

export const useStepNavigation = <TData extends TreeNodeData>(
  args: UseStepNavigationArgs<TData>
) => {
  const {
    activeStepIndex,
    stepsLength,
    setActiveStepIndex,
    setUrlStep,
    toPersistedStepIndex,
    runWithPending,
    updateLocalDraft,
    updateDialogUIState,
    getPersistableDialogUIState,
    commitTreeNodeUpdater,
    nodeId,
    nodeType,
    treeUpdaterTreeNodeId,
    treeUpdaterDraftMetadata,
    localDraftDataRef,
  } = args;

  const setActiveStepIndexRef = useRef(setActiveStepIndex);
  const setUrlStepRef = useRef(setUrlStep);
  const runWithPendingRef = useRef(runWithPending);
  const updateLocalDraftRef = useRef(updateLocalDraft);
  const commitTreeNodeUpdaterRef = useRef(commitTreeNodeUpdater);
  const treeUpdaterTreeNodeIdRef = useRef(treeUpdaterTreeNodeId);
  const treeUpdaterDraftMetadataRef = useRef(treeUpdaterDraftMetadata);
  const updateDialogUIStateRef = useRef(updateDialogUIState);
  const getPersistableDialogUIStateRef = useRef(getPersistableDialogUIState);

  useEffect(() => {
    setActiveStepIndexRef.current = setActiveStepIndex;
    setUrlStepRef.current = setUrlStep;
  }, [setActiveStepIndex, setUrlStep]);

  useEffect(() => {
    runWithPendingRef.current = runWithPending;
  }, [runWithPending]);

  useEffect(() => {
    updateLocalDraftRef.current = updateLocalDraft;
  }, [updateLocalDraft]);

  useEffect(() => {
    commitTreeNodeUpdaterRef.current = commitTreeNodeUpdater;
  }, [commitTreeNodeUpdater]);

  useEffect(() => {
    treeUpdaterTreeNodeIdRef.current = treeUpdaterTreeNodeId;
  }, [treeUpdaterTreeNodeId]);

  useEffect(() => {
    treeUpdaterDraftMetadataRef.current = treeUpdaterDraftMetadata;
  }, [treeUpdaterDraftMetadata]);

  useEffect(() => {
    updateDialogUIStateRef.current = updateDialogUIState;
  }, [updateDialogUIState]);

  useEffect(() => {
    getPersistableDialogUIStateRef.current = getPersistableDialogUIState;
  }, [getPersistableDialogUIState]);

  const activeStepIndexRef = useRef(activeStepIndex);
  const stepsLengthRef = useRef(stepsLength);
  const pendingStepTransitionRef = useRef<{ target: number; resolve: () => void } | null>(null);

  activeStepIndexRef.current = activeStepIndex;
  stepsLengthRef.current = stepsLength;

  useEffect(() => {
    const pending = pendingStepTransitionRef.current;
    if (pending && pending.target === activeStepIndex) {
      pending.resolve();
      pendingStepTransitionRef.current = null;
    }
  }, [activeStepIndex]);

  const handleNavigation = useCallback(
    (event: StepNavigationEvent) => {
      const action: DialogActionInFlight =
        event.type === 'direct'
          ? { type: 'step', index: event.targetIndex ?? activeStepIndexRef.current }
          : { type: event.type };
      void runWithPendingRef.current(action, async () => {
        let nextIndex = activeStepIndexRef.current;
        switch (event.type) {
          case 'direct':
            nextIndex = Math.max(
              0,
              Math.min(event.targetIndex ?? activeStepIndexRef.current, stepsLengthRef.current - 1)
            );
            break;
          case 'next':
            nextIndex = Math.min(activeStepIndexRef.current + 1, stepsLengthRef.current - 1);
            break;
          case 'back':
            nextIndex = Math.max(activeStepIndexRef.current - 1, 0);
            break;
        }
        if (nextIndex === activeStepIndexRef.current) return;
        const waitForTransition = new Promise<void>((resolve) => {
          pendingStepTransitionRef.current = { target: nextIndex, resolve };
        });
        try {
          await Promise.resolve(updateLocalDraftRef.current?.());
        } finally {
          setActiveStepIndexRef.current(nextIndex);
          setUrlStepRef.current(nextIndex);
          updateDialogUIStateRef.current({
            dialogProgress: {
              activeStepIndex: toPersistedStepIndex(nextIndex),
            } as DialogProgressState,
          });
        }
        const commitFn = commitTreeNodeUpdaterRef.current;
        if (commitFn) {
          const persistState = {
            ...getPersistableDialogUIStateRef.current(),
            dialogProgress: { activeStepIndex: toPersistedStepIndex(nextIndex) },
          };
          const targetId = (treeUpdaterTreeNodeIdRef.current ?? nodeId) as NodeId;
          const payload: TreeNodeUpdaterState<Partial<TData>> = {
            treeNodeId: targetId,
            draftMetadata: treeUpdaterDraftMetadataRef.current ?? null,
            draftData: nodeType === 'folder' ? null : { ...(localDraftDataRef.current ?? {}) },
            dialogUIState: persistState,
          };
          try {
            await commitFn('save-draft', payload);
          } catch (err) {
            console.warn('[PluginDialogShell] step persistence failed', err);
          }
        }
        await Promise.race([
          waitForTransition,
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 5000);
          }),
        ]);
        if (pendingStepTransitionRef.current?.target === nextIndex) {
          pendingStepTransitionRef.current = null;
        }
      });
    },
    [nodeId, nodeType, toPersistedStepIndex]
  );

  return { handleNavigation };
};
