/**
 * Test cases for WorkerInitializationReporter
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InitializationStep } from '~/types';
import { WorkerInitializationReporter } from '~/WorkerInitializationReporter';

type WorkerLikeScope = {
  addEventListener: (type: 'message', handler: (event: MessageEvent) => void) => void;
  postMessage: (data: unknown) => void;
};

const mockSelf: WorkerLikeScope = {
  addEventListener: vi.fn<(type: 'message', handler: (event: MessageEvent) => void) => void>(),
  postMessage: vi.fn<(data: unknown) => void>(),
};

type GlobalWithWorker = typeof globalThis & { self: WorkerLikeScope };

const globalWithWorker = globalThis as GlobalWithWorker;
const originalSelf = globalWithWorker.self;

describe('WorkerInitializationReporter', () => {
  let reporter: WorkerInitializationReporter;
  let messageHandler: (event: MessageEvent) => void;

  const defaultSteps: InitializationStep[] = [
    { name: 'Loading modules', weight: 30 },
    { name: 'Initializing database', weight: 40 },
    { name: 'Setting up plugin-loader', weight: 30 },
  ];

  beforeEach(() => {
    // Mock Worker global scope
    globalWithWorker.self = mockSelf;

    // Capture the message handler
    mockSelf.addEventListener.mockImplementation(
      (type: string, handler: (event: MessageEvent) => void) => {
        if (type === 'message') {
          messageHandler = handler;
        }
      }
    );

    // Clear mock calls
    vi.clearAllMocks();

    reporter = new WorkerInitializationReporter(defaultSteps);
  });

  afterEach(() => {
    // Restore original global
    globalWithWorker.self = originalSelf;
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('should send progress updates for each step', () => {
      reporter.reportStepProgress('Loading modules', 50);

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_PROGRESS',
          payload: expect.objectContaining({
            progress: 15, // 30% weight * 50% progress = 15%
            message: 'Loading modules',
          }),
        })
      );

      reporter.reportStepProgress('Loading modules', 100);

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_PROGRESS',
          payload: expect.objectContaining({
            progress: 30, // 30% weight * 100% progress = 30%
            message: 'Loading modules',
          }),
        })
      );
    });

    it('should calculate progress correctly based on step weights', () => {
      // Complete first step (30% weight)
      reporter.reportStepProgress('Loading modules', 100);
      expect(mockSelf.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ progress: 30 }),
        })
      );

      // Half-complete second step (40% weight * 50%)
      reporter.reportStepProgress('Initializing database', 50);
      expect(mockSelf.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ progress: 50 }), // 30% + 20% = 50%
        })
      );

      // Complete second step
      reporter.reportStepProgress('Initializing database', 100);
      expect(mockSelf.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ progress: 70 }), // 30% + 40% = 70%
        })
      );

      // Complete third step
      reporter.reportStepProgress('Setting up plugin-loader', 100);
      expect(mockSelf.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ progress: 100 }), // All complete
        })
      );
    });

    it('should send completion message when all steps finish', () => {
      reporter.reportComplete();

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_COMPLETE',
          payload: expect.objectContaining({
            progress: 100,
            message: 'Worker initialized successfully',
          }),
        })
      );

      expect(reporter.isReady()).toBe(true);
    });

    it('should respond to initialization status requests', () => {
      // Simulate initialization request
      const event = new MessageEvent('message', {
        data: { type: 'INIT_REQUEST' },
      });

      messageHandler(event);

      // Should report current status (0% at start)
      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_PROGRESS',
          payload: expect.objectContaining({
            progress: 0,
            message: 'Starting initialization...',
          }),
        })
      );

      // Progress to 50%
      reporter.reportStepProgress('Loading modules', 100);
      reporter.reportStepProgress('Initializing database', 50);
      vi.clearAllMocks();

      // Request status again
      messageHandler(event);

      // Should report current progress
      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_PROGRESS',
          payload: expect.objectContaining({
            progress: 50,
            message: 'Initializing database',
          }),
        })
      );
    });

    it('should respond to ping requests', () => {
      const event = new MessageEvent('message', {
        data: { type: 'PING' },
      });

      messageHandler(event);

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PING_RESPONSE',
          payload: expect.objectContaining({
            timestamp: expect.any(Number),
          }),
        })
      );
    });

    it('should track async operations with trackInitialization', async () => {
      const mockOperation = vi.fn().mockResolvedValue('result');

      const result = await reporter.trackInitialization('Loading modules', mockOperation);

      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();

      // Should report 0% at start
      expect(mockSelf.postMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'INIT_PROGRESS',
          payload: expect.objectContaining({
            progress: 0,
            message: 'Loading modules',
          }),
        })
      );

      // Should report 100% at end
      expect(mockSelf.postMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'INIT_PROGRESS',
          payload: expect.objectContaining({
            progress: 30, // 30% weight for first step
            message: 'Loading modules',
          }),
        })
      );
    });

    it('should add steps dynamically', () => {
      const newSteps: InitializationStep[] = [{ name: 'Additional step', weight: 10 }];

      reporter.addSteps(newSteps);
      reporter.reportStepProgress('Additional step', 100);

      // Progress should be recalculated with new total weight
      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_PROGRESS',
          payload: expect.objectContaining({
            message: 'Additional step',
          }),
        })
      );
    });
  });

  describe('異常系', () => {
    it('should send error message on initialization failure', () => {
      const error = new Error('Initialization failed');
      reporter.reportError(error);

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_ERROR',
          payload: expect.objectContaining({
            error: 'Initialization failed',
          }),
        })
      );
    });

    it('should handle string errors', () => {
      reporter.reportError('Something went wrong');

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_ERROR',
          payload: expect.objectContaining({
            error: 'Something went wrong',
          }),
        })
      );
    });

    it('should handle unknown step names gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const reporter = new WorkerInitializationReporter(defaultSteps, true);

      reporter.reportStepProgress('Unknown step', 50);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown step'));

      // Should not send any message for unknown step
      expect(mockSelf.postMessage).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should propagate errors from tracked operations', async () => {
      const error = new Error('Operation failed');
      const mockOperation = vi.fn().mockRejectedValue(error);

      await expect(reporter.trackInitialization('Loading modules', mockOperation)).rejects.toThrow(
        'Operation failed'
      );

      // Should send error message
      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_ERROR',
          payload: expect.objectContaining({
            error: 'Operation failed',
          }),
        })
      );
    });
  });

  describe('状態管理', () => {
    it('should track initialization atoms correctly', () => {
      expect(reporter.isReady()).toBe(false);

      reporter.reportComplete();

      expect(reporter.isReady()).toBe(true);
    });

    it('should report complete status when already initialized', () => {
      reporter.reportComplete();
      vi.clearAllMocks();

      // Simulate late initialization request
      const event = new MessageEvent('message', {
        data: { type: 'INIT_REQUEST' },
      });

      messageHandler(event);

      // Should immediately report complete
      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INIT_COMPLETE',
          payload: expect.objectContaining({
            progress: 100,
            message: 'Worker initialized successfully',
          }),
        })
      );
    });
  });
});
