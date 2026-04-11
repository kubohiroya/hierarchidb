import { useCallback, useEffect, useRef } from 'react';
import { notify } from '@hierarchidb/components/notify';
import type { PauseWithCancelHookActionsArgs, ShapeBuildPauseReason } from './types.js';
import { runWithTimeout, waitForSessionStateSync } from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/elapsedConstants';
import { SHAPE_NODE_TYPE } from '~/ui/components/build-progress/shapeBuildTaskSyncDebug';
import { PAUSE_COMMAND_TIMEOUT_MS, PAUSE_STATE_SYNC_TIMEOUT_MS } from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/constants';
import { isShapeBuildPanelDebugEnabled } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelState.utils.js';

export const useShapeBuildPause = ({
  activeNodeId,
  buildStatus,
  runtimeStatus,
  buildSessionTransitionActive,
  isStopRequestedInFlight,
  bridgeRef,
  clearStartPendingRef,
  setRequestedControlAction,
  setIsStopRequested,
  setIsStopAccepted,
  handleCancelQueued,
}: PauseWithCancelHookActionsArgs) => {
  const runtimeStatusRef = useRef(runtimeStatus);
  useEffect(() => {
    runtimeStatusRef.current = runtimeStatus;
  }, [runtimeStatus]);

  const handlePause = useCallback(async (reason: ShapeBuildPauseReason = 'user-pause'): Promise<void> => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return;
    }
    const bridgeApi = bridgeRef.current;
    if (!bridgeApi) {
      notify.warning('Build worker is not ready.');
      return;
    }

    if (isStopRequestedInFlight) return;

    const shouldCancelQueued = buildSessionTransitionActive
      && buildStatus !== 'running'
      && runtimeStatus !== 'running';

    if (shouldCancelQueued) {
      await handleCancelQueued(reason);
      return;
    }

    const pauseRequestedAt = Date.now();
    const shouldLogPauseTrace = isShapeBuildPanelDebugEnabled('startResume');
    const logPauseTrace = (event: string, payload?: Record<string, unknown>): void => {
      if (!shouldLogPauseTrace) return;
      console.log('[ShapeBuildPauseTrace] handlePause', {
        nodeId: String(activeNodeId),
        durationMs: Math.max(0, Date.now() - pauseRequestedAt),
        event,
        reason,
        buildStatus,
        runtimeStatus,
        ...(payload ?? {}),
      });
    };

    logPauseTrace('request-received');
    setRequestedControlAction('pause');
    setIsStopRequested(true);
    clearStartPendingRef.current?.();

    // 強制リセット用のタイマー
    const forceResetTimer = setTimeout(() => {
      logPauseTrace('force-reset-triggered', { reason: 'timeout-exceeded' });
      setIsStopRequested(false);
      setIsStopAccepted(false);
      setRequestedControlAction('none');
      notify.warning('Pause operation timed out. UI state has been reset.');
    }, PAUSE_COMMAND_TIMEOUT_MS + PAUSE_STATE_SYNC_TIMEOUT_MS);

    try {
      await bridgeApi.initialize();

      // Worker側のPause要求を送信
      await runWithTimeout(
        bridgeApi.pauseBuildSession(SHAPE_NODE_TYPE, activeNodeId, reason),
        PAUSE_COMMAND_TIMEOUT_MS,
        `Pause command timed out after ${PAUSE_COMMAND_TIMEOUT_MS}ms while worker is busy.`,
      );

      setIsStopAccepted(true);
      logPauseTrace('worker-request-finished');

      // セッション状態の同期を待機（オプション）
      const sessionSyncSuccess = await waitForSessionStateSync(
        () => runtimeStatusRef.current === 'paused',
        PAUSE_STATE_SYNC_TIMEOUT_MS,
      );

      if (!sessionSyncSuccess) {
        logPauseTrace('session-sync-timeout', {
          reason: 'session-state-not-updated',
          timeoutMs: PAUSE_STATE_SYNC_TIMEOUT_MS
        });
        // セッション同期がタイムアウトしても、Worker側の処理は完了しているため警告のみ
        console.warn('[ShapeBuildPause] Session state sync timed out, but pause command was sent successfully');
      } else {
        logPauseTrace('session-sync-completed');
      }

      clearTimeout(forceResetTimer);
      logPauseTrace('request-finished');
    } catch (error) {
      clearTimeout(forceResetTimer);
      setIsStopRequested(false);
      setIsStopAccepted(false);
      setRequestedControlAction('none');

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeoutError = errorMessage.includes('timed out');

      if (isTimeoutError) {
        notify.error('Pause operation timed out. The build may still be pausing in the background.');
      } else {
        notify.error('Failed to pause build.');
      }

      console.error('[ShapeBuildProgressStep] pause failed', error);
      logPauseTrace('request-failed', {
        errorMessage,
        isTimeoutError,
      });
    }
  }, [
    activeNodeId,
    buildStatus,
    runtimeStatus,
    buildSessionTransitionActive,
    isStopRequestedInFlight,
    bridgeRef,
    clearStartPendingRef,
    setRequestedControlAction,
    handleCancelQueued,
    setIsStopRequested,
    setIsStopAccepted,
  ]);

  return handlePause;
};
