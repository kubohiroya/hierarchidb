import type { BuildSessionStatus } from '../../../../../../../../packages/build-api';
//import { SHAPE_NODE_TYPE } from '../constants';
//import { getErrorMessage, summarizeSelectedEntries } from '../errors';
import type { StartOrResumeExecutionArgs } from './types.js';
import { getErrorMessage, summarizeSelectedEntries } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/errors';
import { SHAPE_NODE_TYPE } from '~/ui/components/build-progress/shapeBuildTaskSyncDebug';

type BaseRequestContext = Pick<
  StartOrResumeExecutionArgs,
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
  data?: StartOrResumeExecutionArgs['data'];
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
  onTrace: StartOrResumeExecutionArgs['onTrace'],
  requestStartedAt: number,
  error: unknown,
): void => {
  onTrace({
    event: 'request-finished:error',
    payload: {
      errorMessage: getErrorMessage(error),
      elapsedMs: Math.max(0, Date.now() - requestStartedAt),
    },
  });
};

export const runResumeSessionRequest = async (context: BaseRequestContext): Promise<void> => {
  const {
    activeNodeId,
    bridgeRef,
    startupSource,
    onTrace,
    requestStartedAt,
    advanceBuildSessionTransitionPhase,
    beginBuildStartupStep,
    finishBuildStartupStep,
    emitBuildSessionTransitionLog,
    runTimedStep,
    updateSessionRecord,
  } = context;

  const bridgeApi = bridgeRef.current;
  if (!bridgeApi || !activeNodeId) {
    return;
  }

  advanceBuildSessionTransitionPhase('starting-session');
  beginBuildStartupStep('session-resume-request', { source: startupSource });
  await runTimedStep('session-resume-request', () => bridgeApi.resumeBuildSession(
    SHAPE_NODE_TYPE,
    activeNodeId,
  ));
  finishBuildStartupStep('session-resume-request', 'success');
  emitBuildSessionTransitionLog('info', 'resume session requested', {
    source: startupSource,
  });

  void updateSessionRecord({
    status: 'running',
    stopReason: undefined,
    canResume: false,
  });

  advanceBuildSessionTransitionPhase('awaiting-first-task', {
    level: 'info',
    message: 'Build resumed. Waiting for worker task updates...',
  });
  beginBuildStartupStep('awaiting-first-task', {
    source: startupSource,
    mode: 'resume',
  });
  onTrace({
    event: 'request-finished:success',
    payload: {
      nextStatus: 'processing',
      elapsedMs: Math.max(0, Date.now() - requestStartedAt),
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
      elapsedMs: Math.max(0, Date.now() - requestStartedAt),
    },
  });

  return { statusResult, selectionSummary, resolvedDataSource };
};
