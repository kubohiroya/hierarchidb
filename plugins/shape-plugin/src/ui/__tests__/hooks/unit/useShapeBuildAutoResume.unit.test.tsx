import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BuildStatus } from '@hierarchidb/ui-build-progress';
import type { NodeId } from '@hierarchidb/core-types';
import { useShapeBuildAutoResume } from '../../../components/build-progress/useShapeBuildAutoResume/useShapeBuildAutoResume';

const createLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

const createArgs = (overrides: Partial<Parameters<typeof useShapeBuildAutoResume>[0]> = {}) => ({
  activeNodeId: 'node-1' as NodeId,
  buildStatus: 'paused' as BuildStatus,
  stopReason: 'route-leave' as const,
  runtimeStatus: 'paused',
  handleStart: vi.fn(async () => true),
  handlePause: vi.fn(),
  hasFailedSourceTasks: false,
  hasDataSource: true,
  hasSelection: true,
  isProcessingValid: true,
  isLockSupported: true,
  ...overrides,
});

describe('useShapeBuildAutoResume', () => {
  beforeEach(() => {
    const storage = window.localStorage as {
      getItem?: (key: string) => string | null;
      setItem?: (key: string, value: string) => void;
      removeItem?: (key: string) => void;
    };
    if (!storage?.getItem || !storage?.setItem || !storage?.removeItem) {
      Object.defineProperty(window, 'localStorage', {
        value: createLocalStorage(),
        configurable: true,
      });
    }
    window.localStorage.removeItem('autoResumeBuild');
  });

  it('auto-resumes when stopReason is route-leave', async () => {
    window.localStorage.setItem('autoResumeBuild', 'node-1');
    const args = createArgs();

    renderHook(() => useShapeBuildAutoResume(args));

    await waitFor(() => {
      expect(args.handleStart).toHaveBeenCalledTimes(1);
    });
    expect(args.handleStart).toHaveBeenCalledWith({
      forceRestart: false,
      autoResume: true,
    });
    expect(window.localStorage.getItem('autoResumeBuild')).toBeNull();
  });

  it('does not auto-resume when stopReason is user-pause', async () => {
    window.localStorage.setItem('autoResumeBuild', 'node-1');
    const args = createArgs({ stopReason: 'user-pause' });

    renderHook(() => useShapeBuildAutoResume(args));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(args.handleStart).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('autoResumeBuild')).toBeNull();
  });

  it('keeps start pending while waiting for runtime transition', async () => {
    const handleStart = vi.fn(async () => true);
    const baseArgs = createArgs({ handleStart });
    const { result, rerender } = renderHook(({ buildStatus }: { buildStatus: BuildStatus }) => (
      useShapeBuildAutoResume({
        ...baseArgs,
        buildStatus,
      })
    ), {
      initialProps: { buildStatus: 'idle' as BuildStatus },
    });

    await act(async () => {
      await result.current.start();
    });

    expect(handleStart).toHaveBeenCalledTimes(1);
    expect(result.current.isStartPending).toBe(true);

    rerender({ buildStatus: 'running' as BuildStatus });

    await waitFor(() => {
      expect(result.current.isStartPending).toBe(false);
    });
  });
});
