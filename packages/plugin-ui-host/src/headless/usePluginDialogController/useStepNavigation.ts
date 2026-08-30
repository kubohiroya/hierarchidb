import type { NodeId, PeerEntity } from '@hierarchidb/core-types';
import type { PluginStepConfig, StepData } from '@hierarchidb/plugin-base';
import type { TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import type {
  CommitDraftMode,
  DialogProgressState,
  DialogUIState,
  TreeNodeData,
} from '@hierarchidb/tree-api';
import type { StepComponentDescriptor, StepNavigationEvent } from '@hierarchidb/ui-dialog';
import { useCallback, useEffect, useRef } from 'react';
import type { DialogActionInFlight, StepTransitionDialogState } from '~/headless/types';

type UseStepNavigationArgs<TData extends PeerEntity<TreeNodeData>> = {
  activeStepIndex: number;
  stepsLength: number;
  setActiveStepIndex: (index: number) => void;
  setUrlStep: (index: number) => void;
  toPersistedStepIndex: (index: number) => number;
  runWithPending: (action: DialogActionInFlight, task: () => Promise<void>) => void;
  updateLocalDraft: () =>
    | Promise<Partial<TreeNodeUpdaterState<TData>> | void>
    | Partial<TreeNodeUpdaterState<TData>>
    | void;
  updateDialogUIState: (patch: Partial<DialogUIState>) => void;
  getPersistableDialogUIState: () => DialogUIState | null;
  setStepTransitionDialog: (state: StepTransitionDialogState | null) => void;
  commitTreeNodeUpdater?: (
    mode: CommitDraftMode,
    payload: TreeNodeUpdaterState<TData>
  ) => Promise<NodeId>;
  activeStepConfig?: PluginStepConfig;
  stepDescriptors: ReadonlyArray<StepComponentDescriptor<Partial<TData>>>;
  dialogData: Partial<TData>;
  uiState?: StepData;
  mode: 'create' | 'edit';
  treeId: string;
  currentNodeVersion?: number;
  nodeId: NodeId;
  parentId: NodeId;
  nodeType: string;
  treeUpdaterTreeNodeId?: NodeId;
  treeUpdaterDraftMetadata: TreeNodeUpdaterState<TData>['draftMetadata'] | null | undefined;
  localDraftDataRef: React.MutableRefObject<Partial<TData>>;
};

export const useStepNavigation = <TData extends PeerEntity<TreeNodeData>>(
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
    setStepTransitionDialog,
    commitTreeNodeUpdater,
    activeStepConfig,
    stepDescriptors,
    dialogData,
    uiState,
    mode,
    treeId,
    currentNodeVersion,
    nodeId,
    parentId,
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
  const setStepTransitionDialogRef = useRef(setStepTransitionDialog);
  const activeStepConfigRef = useRef(activeStepConfig);
  const stepDescriptorsRef = useRef(stepDescriptors);
  const dialogDataRef = useRef(dialogData);
  const uiStateRef = useRef(uiState);
  const currentNodeVersionRef = useRef(currentNodeVersion);

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

  useEffect(() => {
    setStepTransitionDialogRef.current = setStepTransitionDialog;
  }, [setStepTransitionDialog]);

  useEffect(() => {
    activeStepConfigRef.current = activeStepConfig;
  }, [activeStepConfig]);

  useEffect(() => {
    stepDescriptorsRef.current = stepDescriptors;
  }, [stepDescriptors]);

  useEffect(() => {
    dialogDataRef.current = dialogData;
  }, [dialogData]);

  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  useEffect(() => {
    currentNodeVersionRef.current = currentNodeVersion;
  }, [currentNodeVersion]);

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
        const currentIndex = activeStepIndexRef.current;
        const activeConfig = activeStepConfigRef.current;
        const flushedPatch = await Promise.resolve(updateLocalDraftRef.current?.());
        const persistedDialogUIState = {
          ...getPersistableDialogUIStateRef.current(),
          dialogProgress: { activeStepIndex: toPersistedStepIndex(nextIndex) },
        };
        const targetId = (treeUpdaterTreeNodeIdRef.current ?? nodeId) as NodeId;
        const nextDraftData =
          nodeType === 'folder' ? undefined : { ...(localDraftDataRef.current ?? {}) };
        const payload: TreeNodeUpdaterState<TData> = {
          treeNodeId: targetId,
          draftMetadata:
            (flushedPatch?.draftMetadata as TreeNodeUpdaterState<TData>['draftMetadata']) ??
            treeUpdaterDraftMetadataRef.current ??
            null,
          draftData: nodeType === 'folder' ? undefined : nextDraftData,
          dialogUIState: persistedDialogUIState,
        };
        const isForward = nextIndex > currentIndex;
        const guard = isForward ? activeConfig?.capabilities?.beforeNavigateNext : undefined;
        try {
          if (guard) {
            const abortController = new AbortController();
            const dismissDialog = () => setStepTransitionDialogRef.current(null);
            const title =
              mode === 'create' ? 'Creating node' : mode === 'edit' ? 'Updating node' : 'Preparing';
            setStepTransitionDialogRef.current({
              open: true,
              title,
              phase: 'Preparing',
              cancellable: true,
              error: null,
              onCancel: () => abortController.abort(),
            });
            const currentStepId =
              stepDescriptorsRef.current[currentIndex]?.id ?? String(currentIndex);
            const targetStepId = stepDescriptorsRef.current[nextIndex]?.id ?? String(nextIndex);
            const result = await Promise.resolve(
              guard(dialogDataRef.current as StepData, {
                nodeId: String(treeUpdaterTreeNodeIdRef.current ?? nodeId),
                parentId: String(parentId),
                treeId,
                mode,
                currentStepId,
                targetStepId,
                currentStepIndex: currentIndex,
                targetStepIndex: nextIndex,
                currentNodeVersion: currentNodeVersionRef.current,
                dialogData: dialogDataRef.current as StepData,
                draftData: (payload.draftData ?? {}) as StepData,
                uiState: uiStateRef.current,
                signal: abortController.signal,
                setPhase: (phase) => {
                  setStepTransitionDialogRef.current({
                    open: true,
                    title,
                    phase,
                    cancellable: !abortController.signal.aborted,
                    error: null,
                    onCancel: () => abortController.abort(),
                  });
                },
                setCancellable: (cancellable) => {
                  setStepTransitionDialogRef.current({
                    open: true,
                    title,
                    phase: cancellable ? 'Preparing' : 'Committing',
                    cancellable,
                    error: null,
                    onCancel: cancellable ? () => abortController.abort() : undefined,
                  });
                },
              })
            );
            if (result.type === 'stay') {
              setStepTransitionDialogRef.current({
                open: true,
                title,
                phase: 'Failed',
                cancellable: false,
                error: result.reason,
                onDismiss: dismissDialog,
              });
              return;
            }
            if (result.canonicalData) {
              localDraftDataRef.current = result.canonicalData as Partial<TData>;
              payload.draftData =
                nodeType === 'folder' ? undefined : (result.canonicalData as Partial<TData>);
            }
            setStepTransitionDialogRef.current(null);
          }
        } catch (err) {
          if (guard) {
            const message = err instanceof Error ? err.message : String(err);
            setStepTransitionDialogRef.current({
              open: true,
              title: mode === 'create' ? 'Creating node' : 'Updating node',
              phase: 'Failed',
              cancellable: false,
              error: message,
              onDismiss: () => setStepTransitionDialogRef.current(null),
            });
          }
          return;
        }
        const commitFn = commitTreeNodeUpdaterRef.current;
        if (commitFn) {
          try {
            await commitFn('save-draft', payload);
          } catch (err) {
            const draftMeta = payload.draftMetadata as { name?: string; tags?: string[] } | null;
            const draftData = payload.draftData as Record<string, unknown> | undefined;
            const errorName = (err as { name?: string }).name ?? 'Error';
            const errorMessage = (err as { message?: string }).message ?? String(err);
            console.warn(
              '[PluginDialogShell] step persistence failed',
              {
                errorName,
                errorMessage,
                nodeId,
                targetId,
                nodeType,
                nextIndex,
                persistedStepIndex: toPersistedStepIndex(nextIndex),
                treeUpdaterTreeNodeId: treeUpdaterTreeNodeIdRef.current ?? null,
                draftMetadata: draftMeta
                  ? {
                      name: draftMeta.name ?? null,
                      tagsCount: Array.isArray(draftMeta.tags) ? draftMeta.tags.length : 0,
                    }
                  : null,
                draftDataKeys: draftData ? Object.keys(draftData).slice(0, 25) : null,
                dialogProgress: payload.dialogUIState?.dialogProgress ?? null,
              },
              err
            );
            setStepTransitionDialogRef.current({
              open: true,
              title: 'Unable to move to the next step',
              phase: 'Failed',
              cancellable: false,
              error: 'SAVE_DRAFT_FAILED',
              onDismiss: () => setStepTransitionDialogRef.current(null),
            });
            return;
          }
        }
        setActiveStepIndexRef.current(nextIndex);
        setUrlStepRef.current(nextIndex);
        updateDialogUIStateRef.current({
          dialogProgress: {
            activeStepIndex: toPersistedStepIndex(nextIndex),
          } as DialogProgressState,
        });
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
    [mode, nodeId, nodeType, parentId, toPersistedStepIndex, treeId]
  );

  return { handleNavigation };
};
