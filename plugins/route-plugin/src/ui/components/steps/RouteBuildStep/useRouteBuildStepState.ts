import type { BuildStatus as CanonicalBuildStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import {
  resolveBuildSessionProgressPanelSplitViewProps,
  type BuildStatus as UiBuildStatus,
} from '@hierarchidb/ui-build-progress';
import { useCanonicalBuildSessionControls } from '@hierarchidb/ui-build-sessions';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouteBuildCrashInsight } from '~/ui/hooks/useRouteBuildCrashInsight.js';
import { useRouteBuildProgress } from '~/ui/hooks/useRouteBuildProgress.js';
import { routeBuildUiAdapter } from '~/ui/routeBuildUiAdapter.js';
import type { RouteBuildStepProps, RouteBuildStepViewProps } from './types.js';

const requireCanonicalTimestamp = (value: number | undefined, label: string): number => {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `[RouteBuildStep] ${label} must be a finite non-negative timestamp: ${String(value)}`
    );
  }
  return value;
};

export const useRouteBuildStepState = ({
  draft,
  onUpdate,
  nodeId,
}: RouteBuildStepProps): RouteBuildStepViewProps => {
  const { t } = useTranslation('route-plugin');
  const translate = useCallback(
    (key: string, fallback?: string, options?: Record<string, unknown>): string => {
      if (fallback === undefined) {
        throw new Error(`[RouteBuildStep] translation fallback is required for ${key}`);
      }
      return String(t(key, fallback, options));
    },
    [t]
  );
  const routeNodeId = (nodeId as NodeId | undefined) ?? null;
  const {
    progress,
    status: lifecycleStatus,
    lastError,
    subscriptionReady,
  } = useRouteBuildProgress(routeNodeId);
  const {
    canStartBuildSession,
    pendingCommand,
    mutationError,
    cancelQueuedBuildSession,
    pauseBuildSession,
    startBuildSession,
  } = useCanonicalBuildSessionControls({
    nodeId: routeNodeId,
    subscriptionReady,
    commandTransport: routeBuildUiAdapter.commandTransport,
  });
  const canonicalStatus = lifecycleStatus?.status ?? progress?.status;
  const status = routeBuildUiAdapter.resolveUiBuildStatus(canonicalStatus);
  const isQueued = canonicalStatus === 'queued';
  const isMutating = pendingCommand !== null;
  const stages = useMemo(() => routeBuildUiAdapter.resolveStages(translate), [translate]);
  const overallProgress = routeBuildUiAdapter.resolveOverallProgress(status, progress);
  const stageProgress = useMemo(
    () => routeBuildUiAdapter.resolveStageProgress(status, progress),
    [progress, status]
  );
  const hasRequiredFields = routeBuildUiAdapter.hasRequiredFields(routeNodeId, draft);
  const crashInsight = useRouteBuildCrashInsight({
    draft,
    nodeId: routeNodeId ? String(routeNodeId) : null,
    sessionStatus: status,
  });
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [crashDialogOpen, setCrashDialogOpen] = useState(false);
  const completionStatusRef = useRef<UiBuildStatus>(status);
  const persistedStatusRef = useRef<CanonicalBuildStatus | null>(null);

  const handleStartOrResume = useCallback(async (): Promise<void> => {
    await startBuildSession();
  }, [startBuildSession]);

  const handlePause = useCallback(async (): Promise<void> => {
    await pauseBuildSession('user-pause');
  }, [pauseBuildSession]);

  const handleCancelQueued = useCallback(async (): Promise<void> => {
    await cancelQueuedBuildSession('user-cancel');
  }, [cancelQueuedBuildSession]);

  useEffect(() => {
    if (canonicalStatus === undefined || persistedStatusRef.current === canonicalStatus) return;
    const previousStatus = persistedStatusRef.current;
    persistedStatusRef.current = canonicalStatus;
    if (canonicalStatus === 'idle') {
      if (previousStatus === 'queued') {
        onUpdate({ processingStatus: 'pending', buildFinishedAt: undefined });
      }
      return;
    }
    if (canonicalStatus === 'queued') {
      onUpdate({ processingStatus: 'pending', buildFinishedAt: undefined });
      return;
    }
    if (canonicalStatus === 'running') {
      onUpdate({
        processingStatus: 'processing',
        buildStartedAt: requireCanonicalTimestamp(
          lifecycleStatus?.startedAt,
          'running session startedAt'
        ),
        buildFinishedAt: undefined,
        processingError: undefined,
      });
      return;
    }
    if (canonicalStatus === 'paused') {
      onUpdate({ processingStatus: 'pending', buildFinishedAt: undefined });
      return;
    }
    if (canonicalStatus === 'completed') {
      const completedAt = requireCanonicalTimestamp(
        lifecycleStatus?.completedAt,
        'completed session completedAt'
      );
      onUpdate({
        processingStatus: 'completed',
        processedAt: completedAt,
        buildFinishedAt: completedAt,
        processingError: undefined,
      });
      return;
    }
    if (canonicalStatus === 'failed') {
      onUpdate({
        processingStatus: 'failed',
        processingError: lastError ?? translate('build.progress.failedReason', 'Build failed.'),
        buildFinishedAt: requireCanonicalTimestamp(
          lifecycleStatus?.completedAt,
          'failed session completedAt'
        ),
      });
      return;
    }
    throw new Error(`[RouteBuildStep] unsupported canonical session status: ${canonicalStatus}`);
  }, [
    canonicalStatus,
    lastError,
    lifecycleStatus?.completedAt,
    lifecycleStatus?.startedAt,
    onUpdate,
    translate,
  ]);

  useEffect(() => {
    if (completionStatusRef.current === status) return;
    completionStatusRef.current = status;
    if (status === 'paused') {
      setSuspendDialogOpen(true);
    } else {
      setSuspendDialogOpen(false);
    }
    if (status === 'completed' || status === 'failed') {
      setCompletionDialogOpen(true);
    } else {
      setCompletionDialogOpen(false);
    }
  }, [status]);

  const crashMessage = useMemo(() => {
    if (!crashInsight) return null;
    const stageLabel = crashInsight.stage ?? translate('build.unknownStage', 'unknown stage');
    const peakRatio = crashInsight.peakRatio;
    if (peakRatio === undefined) {
      return translate(
        'build.crashHint',
        'A previous build stopped during {{stage}}. Review its canonical task failure before restarting.',
        { stage: stageLabel }
      );
    }
    return translate(
      'build.crashMemoryHint',
      'A previous build stopped during {{stage}} after peak memory reached {{ratio}}. Review the canonical task failure before restarting.',
      { stage: stageLabel, ratio: `${(peakRatio * 100).toFixed(1)}%` }
    );
  }, [crashInsight, translate]);

  useEffect(() => {
    setCrashDialogOpen(crashMessage !== null);
  }, [crashMessage]);

  const summaryItems = useMemo(
    () => [
      {
        id: 'data-source',
        label: translate('build.dataSource', 'Data Source:'),
        value: String(draft.dataSourceName ?? translate('build.notConfigured', 'Not configured')),
      },
      {
        id: 'transport-mode',
        label: translate('build.transportMode', 'Transport Mode:'),
        value: routeBuildUiAdapter.resolveTransportLabel(draft, translate),
      },
      {
        id: 'route-type',
        label: translate('build.routeType', 'Route Type:'),
        value: String(draft.generationMethod ?? translate('build.notConfigured', 'Not configured')),
      },
      {
        id: 'start-location',
        label: translate('build.startLocation', 'Start:'),
        value: String(draft.startLocationId ?? translate('build.notConfigured', 'Not configured')),
      },
      {
        id: 'end-location',
        label: translate('build.endLocation', 'End:'),
        value: String(draft.endLocationId ?? translate('build.notConfigured', 'Not configured')),
      },
    ],
    [draft, translate]
  );

  const splitViewProps = useMemo(
    () => resolveBuildSessionProgressPanelSplitViewProps({ stagesLength: stages.length }),
    [stages.length]
  );
  const visibleError = mutationError?.message ?? lastError;
  const startPending = isQueued || pendingCommand === 'start';
  const stopRequested = pendingCommand === 'pause' || pendingCommand === 'cancel';

  return {
    reviewText: translate(
      'build.review',
      'Review the configuration and press Build to start the canonical route build.'
    ),
    summaryItems,
    missingInputMessage: hasRequiredFields
      ? null
      : translate(
          'build.missingCanonicalInput',
          'Build config, route mode, start/end locations, and line geometry are required.'
        ),
    visibleError,
    progressTitle: translate('build.title', 'Build routes'),
    progressPanelProps: {
      status,
      overallProgress,
      stages,
      stageProgress,
      onPause: status === 'running' && !isMutating ? () => void handlePause() : undefined,
      onResume:
        hasRequiredFields && canStartBuildSession && status !== 'running' && !isQueued
          ? () => void handleStartOrResume()
          : undefined,
      onCancel: isQueued && !isMutating ? () => void handleCancelQueued() : undefined,
      stopRequested,
      startPending,
      showResumeLabel: status === 'paused',
      cancelLabel: translate('build.controls.cancel', 'Cancel'),
      statusLabel: !subscriptionReady
        ? translate('build.status.connectingWorker', 'Connecting to the build worker...')
        : isQueued
          ? translate('build.status.queued', 'Waiting for the canonical build to start...')
          : undefined,
      completionDialog: {
        open: completionDialogOpen,
        onClose: () => setCompletionDialogOpen(false),
        title:
          status === 'completed'
            ? translate('build.progress.completedTitle', 'Build completed')
            : translate('build.progress.failedTitle', 'Build failed'),
        closeLabel: translate('build.controls.close', 'Close'),
        content:
          status === 'completed'
            ? translate('build.progress.completedReason', 'All canonical tasks completed.')
            : (lastError ??
              translate('build.progress.failedReason', 'Build failed due to task errors.')),
      },
      suspendDialog: {
        open: suspendDialogOpen,
        onClose: () => setSuspendDialogOpen(false),
        title: translate('build.progress.pausedTitle', 'Build paused'),
        closeLabel: translate('build.controls.close', 'Close'),
        message: translate(
          'build.progress.pausedReason',
          'The canonical Worker session is paused and can be resumed.'
        ),
      },
      crashDialog: crashMessage
        ? {
            open: crashDialogOpen,
            onClose: () => setCrashDialogOpen(false),
            title: translate('build.progress.crashTitle', 'Previous build interruption'),
            closeLabel: translate('build.controls.close', 'Close'),
            message: crashMessage,
          }
        : undefined,
      ...splitViewProps,
    },
  };
};
