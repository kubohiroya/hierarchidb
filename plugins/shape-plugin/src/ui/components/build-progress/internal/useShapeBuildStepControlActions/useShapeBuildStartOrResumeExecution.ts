import { onTraceFailure, runResumeSessionRequest, runStartSessionRequest } from './useShapeBuildStartOrResumeExecutionHelpers.js';
import type { StartOrResumeExecutionArgs } from './types.js';
import { getErrorMessage, summarizeSelectedEntries, toTransitionErrorMessage } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/errors';

export const executeStartOrResumeFlow = async (args: StartOrResumeExecutionArgs): Promise<boolean> => {
  const {
    activeNodeId,
    data,
    beginBuildSessionTransition,
    advanceBuildSessionTransitionPhase,
    finishBuildSessionTransition,
    beginBuildStartupStep,
    finishBuildStartupStep,
    emitBuildSessionTransitionLog,
    releaseBuildLock,
    tryAcquireBuildLock,
    waitForBuildLock,
    cancelStartRequestRef,
    options,
    startupSource,
    shouldResumeSession,
    onTrace,
    requestStartedAt,
    runTimedStep,
    bridgeRef,
    updateSessionRecord,
  } = args;

  const selectionSummary = summarizeSelectedEntries(data?.selectedArrayByCountries);
  const resolvedDataSource = data?.buildConfig?.dataSourceName;

  onTrace({
    event: 'request-received',
    payload: {
      source: startupSource,
      forceRestart: Boolean(options?.forceRestart),
      buildStatus: args.buildStatus,
      runtimeStatus: args.runtimeStatus,
    },
  });

  const bridgeApi = bridgeRef.current;
  if (!activeNodeId || !bridgeApi) {
    return false;
  }

  beginBuildSessionTransition(
    'acquiring-lock',
    options?.autoResume || shouldResumeSession
      ? 'Resuming build session...'
      : 'Starting build session...',
  );
  beginBuildStartupStep('lock-acquire', {
    source: startupSource,
    mode: shouldResumeSession ? 'resume' : 'start',
  });

  try {
    let acquired = false;
    try {
      acquired = await runTimedStep('lock-acquire', () => tryAcquireBuildLock({
        notifyOnFailure: !options?.autoResume,
      }));
      finishBuildStartupStep('lock-acquire', 'success', { acquired });
    } catch (error) {
      finishBuildStartupStep('lock-acquire', 'error', { errorMessage: getErrorMessage(error) });
      finishBuildSessionTransition({
        level: 'error',
        message: 'Failed to acquire build lock.',
      });
      console.error('[ShapeBuildProgressStep] lock acquire failed', error);
      return false;
    }

    if (!acquired) {
      advanceBuildSessionTransitionPhase('waiting-lock', {
        level: 'info',
        message: 'Waiting for build lock held by another tab...',
      });
      beginBuildStartupStep('lock-wait', { source: startupSource });
      try {
        const queued = await runTimedStep('lock-wait', () => waitForBuildLock(requestStartedAt));
        finishBuildStartupStep('lock-wait', 'success', { queued });
      } catch (error) {
        finishBuildStartupStep('lock-wait', 'error', { errorMessage: getErrorMessage(error) });
        finishBuildSessionTransition({
          level: 'error',
          message: 'Failed while waiting for build lock.',
        });
        console.error('[ShapeBuildProgressStep] lock wait failed', error);
        return false;
      }
      if (cancelStartRequestRef.current) {
        releaseBuildLock();
        finishBuildSessionTransition({
          level: 'warning',
          message: 'Build start was cancelled while waiting for lock.',
        });
        return false;
      }
    }

    if (cancelStartRequestRef.current) {
      releaseBuildLock();
      finishBuildSessionTransition({
        level: 'warning',
        message: 'Build start was cancelled.',
      });
      return false;
    }

    advanceBuildSessionTransitionPhase('saving-draft');
    beginBuildStartupStep('draft-save', { source: startupSource });
    const saved = await runTimedStep('draft-save', () => args.saveDraftBeforeBuild());
    if (!saved) {
      finishBuildStartupStep('draft-save', 'error', { reason: 'save-draft-returned-false' });
      releaseBuildLock();
      finishBuildSessionTransition({
        level: 'error',
        message: 'Failed to start build because draft save did not complete.',
      });
      return false;
    }
    finishBuildStartupStep('draft-save', 'success');

    if (cancelStartRequestRef.current) {
      releaseBuildLock();
      finishBuildSessionTransition({
        level: 'warning',
        message: 'Build start was cancelled.',
      });
      return false;
    }

    advanceBuildSessionTransitionPhase('initializing-worker');
    beginBuildStartupStep('worker-initialize', { source: startupSource });
    try {
      await runTimedStep('worker-initialize', () => bridgeApi.initialize());
      finishBuildStartupStep('worker-initialize', 'success');
    } catch (error) {
      finishBuildStartupStep('worker-initialize', 'error', { errorMessage: getErrorMessage(error) });
      throw error;
    }

    if (cancelStartRequestRef.current) {
      releaseBuildLock();
      finishBuildSessionTransition({
        level: 'warning',
        message: 'Build start was cancelled.',
      });
      return false;
    }

    if (shouldResumeSession) {
    await runResumeSessionRequest({
      activeNodeId,
      bridgeRef,
      updateSessionRecord,
      onTrace,
      emitBuildSessionTransitionLog,
      runTimedStep,
      startupSource,
      requestStartedAt,
      advanceBuildSessionTransitionPhase,
      beginBuildStartupStep,
      finishBuildStartupStep,
    });
      return true;
    }

    if (!resolvedDataSource) {
      finishBuildStartupStep('payload-build', 'error', {
        reason: 'missing-data-source',
        mode: 'worker-side',
      });
      releaseBuildLock();
      finishBuildSessionTransition({
        level: 'error',
        message: 'Failed to start build because data source is missing.',
      });
      return false;
    }
    if (selectionSummary.selectedAdminPairCount === 0) {
      finishBuildStartupStep('payload-build', 'error', {
        reason: 'selection-empty',
        mode: 'worker-side',
      });
      releaseBuildLock();
      finishBuildSessionTransition({
        level: 'error',
        message: 'Failed to start build because selection is empty.',
      });
      return false;
    }

    const { statusResult } = await runStartSessionRequest({
      activeNodeId,
      data,
      bridgeRef,
      emitBuildSessionTransitionLog,
      runTimedStep,
      startupSource,
      onTrace,
      requestStartedAt,
      beginBuildStartupStep,
      finishBuildStartupStep,
      advanceBuildSessionTransitionPhase,
      updateSessionRecord,
    });

    const nextStatus = statusResult.status === 'completed'
      ? 'completed'
      : statusResult.status === 'failed'
        ? 'failed'
        : 'processing';
    void updateSessionRecord({
      status: nextStatus === 'processing' ? 'running' : nextStatus,
      stopReason: nextStatus === 'processing' ? undefined : nextStatus,
      canResume: nextStatus === 'processing',
    });

    if (nextStatus === 'failed') {
      const message = toTransitionErrorMessage(
        statusResult.error,
        'Build failed before task execution started.',
      );
      finishBuildSessionTransition({
        level: 'error',
        message,
      });
    } else if (nextStatus === 'completed') {
      finishBuildSessionTransition({
        level: 'info',
        message: 'Build completed immediately after start.',
      });
    } else {
      advanceBuildSessionTransitionPhase('receiving-task-snapshot', {
        level: 'info',
        message: 'Build requested. Waiting for worker task updates...',
      });
      beginBuildStartupStep('receiving-task-snapshot', {
        source: startupSource,
        mode: 'start',
      });
    }

    return true;
  } catch (error) {
    onTraceFailure(onTrace, requestStartedAt, error);
    releaseBuildLock();
    finishBuildSessionTransition({
      level: 'error',
      message: 'Failed to start or resume build.',
    });
    console.error('[ShapeBuildProgressStep] start/resume failed', error);
    return false;
  }
};
