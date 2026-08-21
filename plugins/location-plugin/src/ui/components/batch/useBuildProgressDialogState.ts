import { resolveBuildSessionProgressPanelSplitViewProps } from '@hierarchidb/ui-build-progress';
import { useCanonicalBuildSessionControls } from '@hierarchidb/ui-build-sessions';
import { i18n as i18nInstance, useTranslation } from '@hierarchidb/ui-i18n';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocationProgress } from '~/common/hooks/useLocationProgress';
import { locationBuildUiAdapter } from '~/ui/locationBuildUiAdapter.js';
import type { BuildProgressDialogProps, BuildProgressDialogState, LogEntry } from './types.js';

const formatTemplate = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));

export const useBuildProgressDialogState = ({
  nodeId,
  draftData,
}: BuildProgressDialogProps): BuildProgressDialogState => {
  const [tabValue, setTabValue] = useState(0);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const tableId = nodeId ? String(nodeId) : null;
  const datasetId = useMemo(() => (tableId ? `location:${tableId}` : null), [tableId]);
  const { t } = useTranslation('location-plugin');
  const locale = (i18nInstance.language ?? 'en') as string;
  const {
    progress: locationProgress,
    sessionStatus,
    subscriptionReady,
    authNotice,
    error: progressError,
  } = useLocationProgress(nodeId, {
    autoSubscribe: true,
  });
  const translate = useCallback(
    (key: string, fallback?: string): string => String(t(key, fallback ?? key)),
    [t]
  );
  const commandTransport = useMemo(
    () => locationBuildUiAdapter.createCommandTransport(draftData ?? null),
    [draftData]
  );
  const {
    canStartBuildSession,
    pendingCommand,
    mutationError,
    cancelQueuedBuildSession,
    pauseBuildSession,
    startBuildSession,
  } = useCanonicalBuildSessionControls({
    nodeId,
    subscriptionReady,
    commandTransport,
  });
  const canonicalStatus = sessionStatus?.status ?? locationProgress?.status;
  const status = locationBuildUiAdapter.resolveUiBuildStatus(canonicalStatus);
  const isQueued = canonicalStatus === 'queued';
  const isMutating = pendingCommand !== null;
  const hasRequiredFields = locationBuildUiAdapter.hasRequiredFields(nodeId, draftData ?? null);
  const stages = useMemo(() => locationBuildUiAdapter.resolveStages(translate), [translate]);
  const overallProgress = locationBuildUiAdapter.resolveOverallProgress(status, locationProgress);
  const stageProgress = useMemo(
    () => locationBuildUiAdapter.resolveStageProgress(status, locationProgress),
    [locationProgress, status]
  );
  const splitViewProps = useMemo(
    () => resolveBuildSessionProgressPanelSplitViewProps({ stagesLength: stages.length }),
    [stages.length]
  );
  const logs = useMemo<LogEntry[]>(() => {
    if (!locationProgress?.message) return [];
    return [
      {
        timestamp: new Date(locationProgress.timestamp),
        level: 'info',
        source: 'BuildWorker',
        message: locationProgress.message,
      },
    ];
  }, [locationProgress?.message, locationProgress?.timestamp]);

  const onTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  }, []);

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
    setSuspendDialogOpen(status === 'paused');
    setCompletionDialogOpen(status === 'completed' || status === 'failed');
  }, [status]);

  const visibleError = mutationError?.message ?? progressError?.message ?? sessionStatus?.error;
  const showAuthRequired = authNotice?.state === 'required';
  const authAlertMessage = formatTemplate(
    translate('batch.authRequired', 'Authentication required - {message}'),
    {
      message:
        authNotice?.message ??
        translate('batch.authFallback', 'Authentication required to continue'),
    }
  );
  const startPending = isQueued || pendingCommand === 'start';
  const stopRequested = pendingCommand === 'pause' || pendingCommand === 'cancel';

  return {
    tabValue,
    onTabChange,
    tableId,
    datasetId,
    locale,
    dialogTitle: translate('batch.dialogTitle', 'Build Progress'),
    closeAriaLabel: translate('common.close', 'Close'),
    closeLabel: translate('batch.close', 'Close'),
    progressTabLabel: translate('batch.progressTitle', 'Progress'),
    logsTabLabel: translate('batch.logsTitle', 'Logs'),
    mapPreviewTabLabel: translate('batch.mapPreviewTitle', 'Map Preview'),
    dataTableTabLabel: translate('batch.dataTableTitle', 'Data Table'),
    phaseLabel: translate(`batch.phases.${status}`, status),
    showAuthRequired,
    authAlertMessage,
    visibleError,
    logs,
    logsEmptyLabel: translate('batch.logsEmpty', 'No log entries yet'),
    mapPlaceholderLabel: translate(
      'batch.mapPlaceholder',
      'Map preview will be added in a future implementation'
    ),
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
        ? translate('build.status.connecting', 'Connecting to the build session...')
        : isQueued
          ? translate('build.status.queued', 'Waiting for the canonical build to start...')
          : locationProgress?.message,
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
            : (visibleError ??
              translate('build.progress.failedReason', 'Build failed due to task errors.')),
      },
      suspendDialog: {
        open: suspendDialogOpen,
        onClose: () => setSuspendDialogOpen(false),
        title: translate('build.progress.pausedTitle', 'Build paused'),
        closeLabel: translate('build.controls.close', 'Close'),
        message: translate(
          'build.progress.pausedReason',
          'The canonical Location session is paused and can be resumed.'
        ),
      },
      ...splitViewProps,
    },
  };
};
