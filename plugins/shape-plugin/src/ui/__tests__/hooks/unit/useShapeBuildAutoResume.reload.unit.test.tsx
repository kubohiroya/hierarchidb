import { renderHook } from '@testing-library/react';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import { useShapeBuildAutoResume } from '../../../components/build-progress/useShapeBuildAutoResume.ts';

describe('useShapeBuildAutoResume reload behavior', () => {
  const activeNodeId = 'node-1' as NodeId;
  const makeHook = (args: Partial<Parameters<typeof useShapeBuildAutoResume>[0]> = {}) => {
    const handleStartOrResume = vi.fn().mockResolvedValue(true);
    const handlePause = vi.fn();
    const result = renderHook(() => useShapeBuildAutoResume({
      activeNodeId,
      buildStatus: 'idle' as BuildStatus,
      stopReason: undefined,
      runtimeStatus: 'processing',
      handleStartOrResume,
      handlePause,
      hasFailedFetchTasks: false,
      hasDataSource: true,
      hasSelection: true,
      isProcessingValid: true,
      isLockSupported: true,
      ...args,
    }));
    return { result, handleStartOrResume, handlePause };
  };

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('auto-resumes when runtimeStatus is processing on reload', async () => {
    window.localStorage.setItem('autoResumeBuild', String(activeNodeId));
    const { handleStartOrResume } = makeHook();
    await vi.waitFor(() => {
      expect(handleStartOrResume).toHaveBeenCalledWith({ forceRestart: false, autoResume: true });
    });
  });

  it('does not auto-resume when build is completed', async () => {
    window.localStorage.setItem('autoResumeBuild', String(activeNodeId));
    const { handleStartOrResume } = makeHook({ buildStatus: 'completed' as BuildStatus });
    await vi.waitFor(() => {
      expect(handleStartOrResume).not.toHaveBeenCalled();
    });
  });

  it('does not auto-resume when stopReason is user-pause', async () => {
    window.localStorage.setItem('autoResumeBuild', String(activeNodeId));
    const { handleStartOrResume } = makeHook({
      buildStatus: 'paused' as BuildStatus,
      stopReason: 'user-pause',
      runtimeStatus: 'paused',
    });
    await vi.waitFor(() => {
      expect(handleStartOrResume).not.toHaveBeenCalled();
    });
  });
});
