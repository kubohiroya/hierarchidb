import type { BuildSessionStatus } from '@hierarchidb/build-api';
import type { StartExecutionArgs } from './types.js';
import { getErrorMessage, summarizeSelectedEntries } from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/errorConstants';
import { SHAPE_NODE_TYPE } from '~/ui/components/build-progress/shapeBuildTaskSyncDebug';

type BaseRequestContext = Pick<
  StartExecutionArgs,
  | 'bridgeRef'
  | 'activeNodeId'
  | 'advanceBuildSessionTransitionPhase'
  | 'beginBuildStartupStep'
  | 'finishBuildStartupStep'
  | 'emitBuildSessionTransitionLog'
  | 'runTimedStep'
  | 'startupSource'
  | 'requestStartedAt'
  | 'onTrace'
  | 'updateSessionRecord'
>;

type StartSessionRequestContext = BaseRequestContext & {
  data?: StartExecutionArgs['data'];
};

type StartSessionResponse = {
  status: BuildSessionStatus['status'];
  error?: BuildSessionStatus['error'];
};

type StartSessionResult = {
  statusResult: StartSessionResponse;
  selectionSummary: ReturnType<typeof summarizeSelectedEntries>;
  resolvedDataSource: string | null | undefined;
};

export const onTraceFailure = (
  onTrace: StartExecutionArgs['onTrace'],
  requestStartedAt: number,
  error: unknown,
): void => {
  onTrace({
    event: 'request-finished:error',
    payload: {
      errorMessage: getErrorMessage(error),
      durationMs: Math.max(0, Date.now() - requestStartedAt),
    },
  });
};

export const runStartSessionRequest = async (context: StartSessionRequestContext): Promise<StartSessionResult> => {
  const {
    activeNodeId,
    bridgeRef,
    startupSource,
    runTimedStep,
    beginBuildStartupStep,
    finishBuildStartupStep,
    emitBuildSessionTransitionLog,
    data,
    onTrace,
    requestStartedAt,
  } = context;

  const bridgeApi = bridgeRef.current;
  if (!bridgeApi || !activeNodeId) {
    throw new Error('Build worker is not ready.');
  }

  const selectionSummary = summarizeSelectedEntries(data?.selectedArrayByCountries);
  const resolvedDataSource = data?.buildConfig?.dataSourceName;

  beginBuildStartupStep('payload-build', {
    source: startupSource,
    mode: 'worker-side',
    dataSource: resolvedDataSource ?? null,
    selectedCountryCount: selectionSummary.selectedCountryCount,
    selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
  });
  finishBuildStartupStep('payload-build', 'success', {
    mode: 'worker-side',
    dataSource: resolvedDataSource,
    selectedCountryCount: selectionSummary.selectedCountryCount,
    selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
  });

  beginBuildStartupStep('session-start-request', {
    source: startupSource,
    payloadMode: 'worker-side',
    selectedCountryCount: selectionSummary.selectedCountryCount,
    selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
  });
  const statusResult = await runTimedStep('session-start-request', () => (
    bridgeApi.startBuildSession(SHAPE_NODE_TYPE, activeNodeId, undefined)
  ));
  finishBuildStartupStep('session-start-request', 'success', {
    status: statusResult.status,
    hasError: Boolean(statusResult.error),
    payloadMode: 'worker-side',
  });
  emitBuildSessionTransitionLog('info', 'start session response', {
    status: statusResult.status,
    hasError: Boolean(statusResult.error),
  });
  onTrace({
    event: 'request-finished:success',
    payload: {
      nextStatus: statusResult.status,
      durationMs: Math.max(0, Date.now() - requestStartedAt),
    },
  });

  return { statusResult, selectionSummary, resolvedDataSource };
};
