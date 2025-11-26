import { useEffect } from 'react';
import type { DialogStateAPI } from '@hierarchidb/common-api';
import type { NodeId } from '@hierarchidb/common-types';
import type { MultiStepDialogState } from '../controller/types.js';

interface Params {
  dialogStateApi: DialogStateAPI | null;
  nodeType: string;
  nodeId: NodeId;
  steps: Array<{ id: string; label?: string; optional?: boolean }>;
  activeStepIndex: number;
  enabledStepIndices: number[];
  validatedStepIndices: number[];
  guards: {
    canProceedNext?: boolean;
    canGoBack?: boolean;
    canSave?: boolean;
    canStartBatch?: boolean;
  };
  dialogTitle: string;
  headerSubtitle?: string;
  committableStepIndices: number[];
  open: boolean;
  setDialogStateError: (value: Error) => void;
}

export function useDialogStatePublisher({
  dialogStateApi,
  nodeType,
  nodeId,
  steps,
  activeStepIndex,
  enabledStepIndices,
  validatedStepIndices,
  guards,
  dialogTitle,
  headerSubtitle,
  committableStepIndices,
  open,
  setDialogStateError,
}: Params) {
  useEffect(() => {
    if (!dialogStateApi) return;
    if (!nodeType || !nodeId) return;
    if (!steps.length) return;
    if (!open) return;

    const enabledSet = new Set(enabledStepIndices);
    const validatedSet = new Set(validatedStepIndices);

    const stepStatuses = steps.map((step, idx) => ({
      id: step.id,
      title: step.label ?? step.id,
      enabled: enabledSet.has(idx) || idx === activeStepIndex,
      completed: validatedSet.has(idx),
      error: undefined as string | null | undefined,
    }));

    const snapshot: MultiStepDialogState = {
      nodeId,
      activeStepIndex,
      steps: stepStatuses,
      canProceedNext: Boolean(guards.canProceedNext),
      canGoBack: Boolean(guards.canGoBack),
      canSave: Boolean(guards.canSave),
      canStartBatch: Boolean(guards.canStartBatch),
      validationErrors: undefined,
      updatedAt: Date.now(),
      metadata: {
        title: dialogTitle,
        subtitle: headerSubtitle,
        committableStepIndices,
      },
    };

    const publishState = dialogStateApi.publishState;

    publishState({ nodeType, nodeId, state: snapshot }).catch((error) => {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[PluginDialogShell] failed to publish dialog state', error);
      }
      const normalizedError =
        error instanceof Error ? error : new Error(String(error ?? 'Failed to publish state'));
      setDialogStateError(normalizedError);
    });
  }, [
    dialogStateApi,
    nodeType,
    nodeId,
    steps,
    activeStepIndex,
    enabledStepIndices,
    validatedStepIndices,
    guards.canProceedNext,
    guards.canGoBack,
    guards.canSave,
    guards.canStartBatch,
    dialogTitle,
    headerSubtitle,
    committableStepIndices,
    open,
    setDialogStateError,
  ]);

  useEffect(() => {
    if (!dialogStateApi) return;
    if (!nodeType || !nodeId) return;
    if (open) return;

    const publishState = dialogStateApi.publishState;
    publishState({ nodeType, nodeId, state: null }).catch(() => {});
  }, [dialogStateApi, nodeType, nodeId, open]);

  useEffect(
    () => () => {
      if (!dialogStateApi || !nodeType || !nodeId) return;
      const publishState = dialogStateApi.publishState;
      if (typeof publishState !== 'function') return;
      publishState({ nodeType, nodeId, state: null }).catch(() => {});
    },
    [dialogStateApi, nodeType, nodeId]
  );
}
