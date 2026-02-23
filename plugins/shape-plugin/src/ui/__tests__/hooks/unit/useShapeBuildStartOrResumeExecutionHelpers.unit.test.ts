import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runResumeSessionRequest,
  runStartSessionRequest,
} from '../../../components/build-progress/internal/useShapeBuildStepControlActions/useShapeBuildStartOrResumeExecutionHelpers';

describe('useShapeBuildStartOrResumeExecutionHelpers', () => {
  let onTrace: ReturnType<typeof vi.fn>;
  let beginBuildStartupStep: ReturnType<typeof vi.fn>;
  let finishBuildStartupStep: ReturnType<typeof vi.fn>;
  let emitBuildSessionTransitionLog: ReturnType<typeof vi.fn>;
  let advanceBuildSessionTransitionPhase: ReturnType<typeof vi.fn>;
  let updateSessionRecord: ReturnType<typeof vi.fn>;
  let runTimedStep: ReturnType<typeof vi.fn>;
  let bridgeRef: { current: { startBuildSession: ReturnType<typeof vi.fn>; resumeBuildSession: ReturnType<typeof vi.fn> } };

  const createRunTimedStep = () => (stepName: string, runner: () => Promise<unknown>) => {
    runTimedStep(stepName, runner);
    return runner();
  };

  beforeEach(() => {
    onTrace = vi.fn();
    beginBuildStartupStep = vi.fn();
    finishBuildStartupStep = vi.fn();
    emitBuildSessionTransitionLog = vi.fn();
    advanceBuildSessionTransitionPhase = vi.fn();
    updateSessionRecord = vi.fn().mockResolvedValue(true);
    runTimedStep = vi.fn((_: string, task: () => Promise<unknown>) => task());
    bridgeRef = {
      current: {
        startBuildSession: vi.fn(async () => ({ status: 'running' as const })),
        resumeBuildSession: vi.fn(async () => {}),
      },
    };
  });

  it('runStartSessionRequest sends a worker start request and records success trace', async () => {
    const result = await runStartSessionRequest({
      activeNodeId: 'node-start-test',
      bridgeRef,
      onTrace,
      startupSource: 'manual',
      requestStartedAt: 1_700_000_000_000,
      beginBuildStartupStep,
      finishBuildStartupStep,
      emitBuildSessionTransitionLog,
      runTimedStep,
      data: {
        buildConfig: {
          dataSourceName: 'manual-ds',
        },
        selectedArrayByCountries: [],
      },
      advanceBuildSessionTransitionPhase,
    });

    expect(bridgeRef.current.startBuildSession).toHaveBeenCalledWith(
      'shape',
      'node-start-test',
      undefined,
    );
    expect(beginBuildStartupStep).toHaveBeenCalledWith('payload-build', expect.objectContaining({
      source: 'manual',
      mode: 'worker-side',
      dataSource: 'manual-ds',
    }));
    expect(finishBuildStartupStep).toHaveBeenCalledWith(
      'session-start-request',
      'success',
      expect.objectContaining({
        status: 'running',
        hasError: false,
      }),
    );
    expect(emitBuildSessionTransitionLog).toHaveBeenCalledWith(
      'info',
      'start session response',
      expect.objectContaining({ status: 'running', hasError: false }),
    );
    expect(onTrace).toHaveBeenCalledWith(expect.objectContaining({
      event: 'request-finished:success',
      payload: expect.objectContaining({ nextStatus: 'running' }),
    }));
    expect(result.statusResult.status).toBe('running');
  });

  it('runResumeSessionRequest sends a worker resume request and updates local session state', async () => {
    await runResumeSessionRequest({
      activeNodeId: 'node-resume-test',
      bridgeRef,
      onTrace,
      startupSource: 'manual',
      requestStartedAt: 1_700_000_000_100,
      beginBuildStartupStep,
      finishBuildStartupStep,
      emitBuildSessionTransitionLog,
      runTimedStep,
      advanceBuildSessionTransitionPhase,
      updateSessionRecord,
    });

    expect(bridgeRef.current.resumeBuildSession).toHaveBeenCalledWith(
      'shape',
      'node-resume-test',
    );
    expect(beginBuildStartupStep).toHaveBeenCalledWith(
      'session-resume-request',
      expect.objectContaining({ source: 'manual' }),
    );
    expect(finishBuildStartupStep).toHaveBeenCalledWith(
      'session-resume-request',
      'success',
    );
    expect(updateSessionRecord).toHaveBeenCalledWith({
      status: 'running',
      stopReason: undefined,
      canResume: false,
    });
    expect(advanceBuildSessionTransitionPhase).toHaveBeenCalledWith(
      'awaiting-first-task',
      expect.objectContaining({ level: 'info' }),
    );
    expect(onTrace).toHaveBeenCalledWith(expect.objectContaining({
      event: 'request-finished:success',
      payload: expect.objectContaining({ nextStatus: 'processing' }),
    }));
  });
});
