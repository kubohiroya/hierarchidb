import { useCallback, useMemo } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { TaskProgressControls } from '~/ui/atoms/shapeBuildProgressAtoms';
import { logStartResumeTrace } from './useBuildProgressPanelState.utils.js';

type Params = {
  resolvedNodeId?: NodeId;
  buildStatus: BuildStatus;
  startWarning: boolean;
  warningMessage: string | null;
  controls: TaskProgressControls;
  localStartPending: boolean;
  setWarningDialogOpen: (open: boolean) => void;
  setLocalStartPending: (next: boolean) => void;
  localStartPendingRef: { current: boolean };
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
    setLocalStartPending,
    localStartPendingRef,
  } = params;

  const nodeId = resolvedNodeId ? String(resolvedNodeId) : null;

  const runStartOrResume = useCallback(async () => {
    const requestStartedAt = Date.now();
    const startHandler = controls.handleStartOrResume;
    logStartResumeTrace('runStartOrResume invoked', {
      nodeId,
      localStartPending: localStartPendingRef.current,
      controlStartPending: Boolean(controls.startPending),
      hasStartHandler: Boolean(startHandler),
      buildStatus,
    });
    if (localStartPendingRef.current) {
      logStartResumeTrace('runStartOrResume skipped (already pending)', { nodeId });
      return;
    }
    if (!startHandler) {
      logStartResumeTrace('runStartOrResume skipped (missing handler)', { nodeId });
      return;
    }
    setLocalStartPending(true);
    logStartResumeTrace('runStartOrResume pending enabled', { nodeId });
    const waitTimer = window.setInterval(() => {
      logStartResumeTrace('runStartOrResume waiting for handler', {
        nodeId,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
      });
    }, 3000);
    try {
      await startHandler();
      logStartResumeTrace('runStartOrResume handler resolved', {
        nodeId,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
      });
    } catch (error) {
      logStartResumeTrace('runStartOrResume handler rejected', {
        nodeId,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      window.clearInterval(waitTimer);
      setLocalStartPending(false);
      logStartResumeTrace('runStartOrResume pending cleared', {
        nodeId,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
      });
    }
  }, [
    buildStatus,
    controls.handleStartOrResume,
    controls.startPending,
    localStartPendingRef,
    nodeId,
    setLocalStartPending,
  ]);

  const mergedControls = useMemo(() => ({
    ...controls,
    startPending: Boolean(controls.startPending) || localStartPending,
  }), [controls]);

  const handleStartClick = useCallback(async () => {
    if (startWarning) {
      logStartResumeTrace('handleStartClick blocked by warning dialog', {
        nodeId,
        warningMessage,
      });
      setWarningDialogOpen(true);
      return;
    }
    logStartResumeTrace('handleStartClick proceed', {
      nodeId,
      buildStatus,
    });
    await runStartOrResume();
  }, [buildStatus, nodeId, runStartOrResume, setWarningDialogOpen, startWarning, warningMessage]);

  const handleConfirmStart = useCallback(async () => {
    logStartResumeTrace('handleConfirmStart proceed', {
      nodeId,
      buildStatus,
    });
    setWarningDialogOpen(false);
    await runStartOrResume();
  }, [buildStatus, nodeId, runStartOrResume, setWarningDialogOpen]);

  return {
    mergedControls,
    handleStartClick,
    handleConfirmStart,
  };
};
