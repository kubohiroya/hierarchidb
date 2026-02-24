import { useCallback, useEffect, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import type { BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import { UI_POLL_INTERVAL_MS, UI_QUIET_THRESHOLD_MS } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/constants.js';

type UseShapeBuildProgressResidueMonitorArgs = {
  activeNodeId: NodeId | null;
  buildSessionTransitionActive: boolean;
  crashCheckStartedAtRef: { current: number };
  buildStatus: BuildProgressStatus['status'];
  runtimeStatus: BuildProgressStatus['status'];
  sessionRecord: ShapeBuildSessionRecord | null;
  shouldMonitor: boolean;
  t: (key: string, fallback: string) => string;
  closeCrashSuspect: () => void;
  closeSuspendSuspect: () => void;
};

export const useShapeBuildProgressResidueMonitor = ({
  activeNodeId,
  buildSessionTransitionActive,
  crashCheckStartedAtRef,
  buildStatus,
  runtimeStatus,
  sessionRecord,
  shouldMonitor,
  t,
  closeCrashSuspect,
  closeSuspendSuspect,
}: UseShapeBuildProgressResidueMonitorArgs) => {
  const [crashSuspectOpen, setCrashSuspectOpen] = useState(false);
  const [crashSuspectMessage, setCrashSuspectMessage] = useState<string | null>(null);
  const [suspendSuspectOpen, setSuspendSuspectOpen] = useState(false);
  const [suspendSuspectMessage, setSuspendSuspectMessage] = useState<string | null>(null);

  const closeCrashSuspectInternal = useCallback(() => {
    setCrashSuspectOpen(false);
    setCrashSuspectMessage(null);
    crashCheckStartedAtRef.current = Date.now();
    closeCrashSuspect();
  }, [closeCrashSuspect, crashCheckStartedAtRef]);

  const closeSuspendSuspectInternal = useCallback(() => {
    setSuspendSuspectOpen(false);
    setSuspendSuspectMessage(null);
    crashCheckStartedAtRef.current = Date.now();
    closeSuspendSuspect();
  }, [closeSuspendSuspect, crashCheckStartedAtRef]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (buildSessionTransitionActive) {
      if (crashSuspectOpen) {
        closeCrashSuspectInternal();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspectInternal();
      }
      return;
    }
    if (!shouldMonitor) {
      if (crashSuspectOpen) {
        closeCrashSuspectInternal();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspectInternal();
      }
      return;
    }
    if (buildStatus === 'processing' || runtimeStatus === 'processing') {
      if (crashSuspectOpen) {
        closeCrashSuspectInternal();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspectInternal();
      }
      return;
    }

    const now = Date.now();
    const elapsedSinceStart = now - crashCheckStartedAtRef.current;
    if (elapsedSinceStart < UI_QUIET_THRESHOLD_MS) return;

    const stageHeartbeatAt = sessionRecord?.stageHeartbeatAt ?? sessionRecord?.updatedAt ?? null;
    const suspectWindowMs = UI_QUIET_THRESHOLD_MS + UI_POLL_INTERVAL_MS * 2;
    if (stageHeartbeatAt && now - stageHeartbeatAt <= suspectWindowMs) {
      if (crashSuspectOpen) {
        closeCrashSuspectInternal();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspectInternal();
      }
      return;
    }

    if (suspendSuspectOpen) {
      closeSuspendSuspectInternal();
    }
    if (!crashSuspectOpen) {
      setCrashSuspectMessage(
        t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
      );
      setCrashSuspectOpen(true);
    }
  }, [
    activeNodeId,
    buildStatus,
    buildSessionTransitionActive,
    crashCheckStartedAtRef.current,
    closeCrashSuspectInternal,
    closeSuspendSuspectInternal,
    crashSuspectOpen,
    runtimeStatus,
    sessionRecord,
    shouldMonitor,
    suspendSuspectOpen,
    t,
  ]);

  return {
    crashSuspectOpen,
    crashSuspectMessage,
    setCrashSuspectOpen: closeCrashSuspectInternal,
    suspendSuspectOpen,
    suspendSuspectMessage,
    setSuspendSuspectOpen: closeSuspendSuspectInternal,
  };
};

