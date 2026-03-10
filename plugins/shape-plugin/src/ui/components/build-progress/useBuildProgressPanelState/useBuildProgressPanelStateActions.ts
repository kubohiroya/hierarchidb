import { useCallback, useMemo } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { TaskProgressControls } from '~/ui/atoms/shapeBuildProgressTypes';
import { logStartTrace } from './useBuildProgressPanelState.utils.js';
import type { PendingUserAction } from '~/ui/atoms/buildSessionStateAtoms';

type Params = {
  resolvedNodeId?: NodeId;
  buildStatus: BuildStatus;
  startWarning: boolean;
  warningMessage: string | null;
  controls: TaskProgressControls;
  localStartPending: boolean;
  setWarningDialogOpen: (open: boolean) => void;
  setPendingUserAction: (next: PendingUserAction) => void;
};

type Return = {
  mergedControls: TaskProgressControls & { startPending: boolean };
  handleStartClick: () => Promise<void>;
  handleConfirmStart: () => Promise<void>;
};

export const useBuildProgressPanelStateActions = (params: Params): Return => {
  const {
    resolvedNodeId,
    buildStatus,
    startWarning,
    warningMessage,
    controls,
    localStartPending,
    setWarningDialogOpen,
    setPendingUserAction,
  } = params;

  const nodeId = resolvedNodeId ? String(resolvedNodeId) : null;

  const runStart = useCallback(async () => {
    const requestStartedAt = Date.now();
    const startHandler = controls.handleStart;
    logStartTrace('runStart invoked', {
      nodeId,
      localStartPending,
      controlStartPending: Boolean(controls.startPending),
      hasStartHandler: Boolean(startHandler),
      buildStatus,
    });
    if (localStartPending) {
      logStartTrace('runStart skipped (already pending)', { nodeId });
      return;
    }
    if (!startHandler) {
      logStartTrace('runStart skipped (missing handler)', { nodeId });
      return;
    }
    setPendingUserAction('starting');
    logStartTrace('runStart pending enabled', { nodeId });
    const waitTimer = window.setInterval(() => {
      logStartTrace('runStart waiting for handler', {
        nodeId,
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      });
    }, 3000);
    try {
      await startHandler();
      logStartTrace('runStart handler resolved', {
        nodeId,
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      });
    } catch (error) {
      logStartTrace('runStart handler rejected', {
        nodeId,
        durationMs: Math.max(0, Date.now() - requestStartedAt),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      window.clearInterval(waitTimer);
      setPendingUserAction('none');
      logStartTrace('runStart pending cleared', {
        nodeId,
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      });
    }
  }, [
    buildStatus,
    controls.handleStart,
    controls.startPending,
    localStartPending,
    nodeId,
    setPendingUserAction,
  ]);

  const mergedControls = useMemo(() => ({
    ...controls,
    startPending: Boolean(controls.startPending) || localStartPending,
  }), [controls]);

  const handleStartClick = useCallback(async () => {
    if (startWarning) {
      logStartTrace('handleStartClick blocked by warning dialog', {
        nodeId,
        warningMessage,
      });
      setWarningDialogOpen(true);
      return;
    }
    logStartTrace('handleStartClick proceed', {
      nodeId,
      buildStatus,
    });
    await runStart();
  }, [buildStatus, nodeId, runStart, setWarningDialogOpen, startWarning, warningMessage]);

  const handleConfirmStart = useCallback(async () => {
    logStartTrace('handleConfirmStart proceed', {
      nodeId,
      buildStatus,
    });
    setWarningDialogOpen(false);
    await runStart();
  }, [buildStatus, nodeId, runStart, setWarningDialogOpen]);

  return {
    mergedControls,
    handleStartClick,
    handleConfirmStart,
  };
};
