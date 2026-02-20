/**
 * workerClient.test.ts - Tests for Worker initialization service
 *
 * Phase 4: Worker initialization refactor tests
 * Tests retry logic, timeout handling, and success scenarios
 */

import type { BuildWorkerAPI } from '../../../../types/worker-api.ts';
import type { Remote } from 'comlink';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWorkerInitCompleteMessage,
  getWorkerInitStartMessage,
} from '../../../../i18n/workerInitMessages.ts';

// Mock the WorkerStateStore module
vi.mock('../../../../worker-runtime/WorkerStateStore.js', () => ({
  ensureWorkerInitialized: vi.fn(),
  getWorkerSnapshot: vi.fn(() => ({
    state: 'uninitialized',
    client: null,
    error: null,
    progress: { progress: 0, message: getWorkerInitStartMessage() },
  })),
}));

describe('workerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ensureWorkerStarted', () => {
    it('should successfully initialize worker on first try', async () => {
      // Import after mocks are set up
      const { ensureWorkerInitialized } = await import(
        '../../../../worker-runtime/WorkerStateStore.ts'
      );
      const { ensureWorkerStarted } = await import('../../workerClient.ts');

      const mockClient = { ping: vi.fn() } as unknown as Remote<BuildWorkerAPI>;
      vi.mocked(ensureWorkerInitialized).mockResolvedValue(mockClient);

      const result = await ensureWorkerStarted();

      expect(ensureWorkerInitialized).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockClient);
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const { ensureWorkerInitialized } = await import(
        '../../../../worker-runtime/WorkerStateStore.ts'
      );
      const { ensureWorkerStarted } = await import('../../workerClient.ts');

      const mockClient = { ping: vi.fn() } as unknown as Remote<BuildWorkerAPI>;

      // First call fails, second succeeds
      vi.mocked(ensureWorkerInitialized)
        .mockRejectedValueOnce(new Error('Worker initialization failed'))
        .mockResolvedValueOnce(mockClient);

      const result = await ensureWorkerStarted({
        retryDelays: [100], // Short delay for testing
        timeoutMs: 5000,
      });

      expect(ensureWorkerInitialized).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockClient);
    });

    it('should throw error after all retries exhausted', async () => {
      const { ensureWorkerInitialized } = await import(
        '../../../../worker-runtime/WorkerStateStore.ts'
      );
      const { ensureWorkerStarted } = await import('../../workerClient.ts');

      const error = new Error('Worker initialization failed');
      vi.mocked(ensureWorkerInitialized).mockRejectedValue(error);

      await expect(
        ensureWorkerStarted({
          retryDelays: [10, 20], // Two retries with short delays
          timeoutMs: 5000,
        })
      ).rejects.toThrow('Worker initialization failed after 3 attempts');

      expect(ensureWorkerInitialized).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should timeout if initialization takes too long', async () => {
      const { ensureWorkerInitialized } = await import(
        '../../../../worker-runtime/WorkerStateStore.ts'
      );
      const { ensureWorkerStarted } = await import('../../workerClient.ts');

      // Mock a never-resolving promise
      vi.mocked(ensureWorkerInitialized).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      await expect(
        ensureWorkerStarted({
          retryDelays: [],
          timeoutMs: 100, // Very short timeout
        })
      ).rejects.toThrow('Worker initialization timeout');

      expect(ensureWorkerInitialized).toHaveBeenCalled();
    }, 10000); // Give the test itself more time

    it('should use default retry delays if not specified', async () => {
      const { ensureWorkerInitialized } = await import(
        '../../../../worker-runtime/WorkerStateStore.ts'
      );
      const { ensureWorkerStarted } = await import('../../workerClient.ts');

      const mockClient = { ping: vi.fn() } as unknown as Remote<BuildWorkerAPI>;
      vi.mocked(ensureWorkerInitialized).mockResolvedValue(mockClient);

      const result = await ensureWorkerStarted();

      expect(result).toBe(mockClient);
      expect(ensureWorkerInitialized).toHaveBeenCalledTimes(1);
    });

    it('should handle AbortSignal correctly', async () => {
      const { ensureWorkerInitialized } = await import(
        '../../../../worker-runtime/WorkerStateStore.ts'
      );
      const { ensureWorkerStarted } = await import('../../workerClient.ts');

      const controller = new AbortController();
      const mockClient = { ping: vi.fn() } as unknown as Remote<BuildWorkerAPI>;

      // Verify signal is passed through
      vi.mocked(ensureWorkerInitialized).mockImplementation(async (options) => {
        expect(options?.signal).toBe(controller.signal);
        return mockClient;
      });

      const result = await ensureWorkerStarted({
        signal: controller.signal,
      });

      expect(result).toBe(mockClient);
    });

    it('should respect aborted signal and throw immediately', async () => {
      const { ensureWorkerStarted } = await import('../../workerClient.ts');

      const controller = new AbortController();
      controller.abort(); // Abort before calling

      await expect(
        ensureWorkerStarted({
          signal: controller.signal,
        })
      ).rejects.toThrow('aborted');
    });
  });

  describe('getWorkerClient', () => {
    it('should return cached client if available', async () => {
      const { getWorkerSnapshot } = await import('../../../../worker-runtime/WorkerStateStore.ts');
      const { getWorkerClient } = await import('../../workerClient.ts');

      const mockClient = { ping: vi.fn() } as unknown as Remote<BuildWorkerAPI>;
      vi.mocked(getWorkerSnapshot).mockReturnValue({
        state: 'ready',
        client: mockClient,
        error: null,
        progress: { progress: 100, message: getWorkerInitCompleteMessage() },
      });

      const result = getWorkerClient();

      expect(result).toBe(mockClient);
    });

    it('should return null if worker not initialized', async () => {
      const { getWorkerSnapshot } = await import('../../../../worker-runtime/WorkerStateStore.ts');
      const { getWorkerClient } = await import('../../workerClient.ts');

      vi.mocked(getWorkerSnapshot).mockReturnValue({
        state: 'uninitialized',
        client: null,
        error: null,
        progress: { progress: 0, message: getWorkerInitStartMessage() },
      });

      const result = getWorkerClient();

      expect(result).toBeNull();
    });
  });
});
