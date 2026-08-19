import { describe, expect, it, vi } from 'vitest';
import {
  finalizePipelineOutcome,
  persistFailureAndRethrow,
} from '../../worker/api/shapeBuildRuntimeFailureHandling.js';

describe('shape build runtime failure handling', () => {
  it('persists a terminal failure before rethrowing the originating error', async () => {
    const originalError = new Error('selected inputs produced no source tasks');
    const persist = vi.fn(async () => undefined);
    const onPersistenceError = vi.fn();

    await expect(persistFailureAndRethrow(originalError, persist, onPersistenceError)).rejects.toBe(
      originalError
    );
    expect(persist).toHaveBeenCalledOnce();
    expect(onPersistenceError).not.toHaveBeenCalled();
  });

  it('preserves the originating error when failure persistence also fails', async () => {
    const originalError = new Error('source planning failed');
    const persistenceError = new Error('session persistence failed');
    const onPersistenceError = vi.fn();

    await expect(
      persistFailureAndRethrow(
        originalError,
        async () => {
          throw persistenceError;
        },
        onPersistenceError
      )
    ).rejects.toBe(originalError);
    expect(onPersistenceError).toHaveBeenCalledWith(persistenceError);
  });

  it('does not reclassify a success finalizer failure as a pipeline failure', async () => {
    const finalizationError = new Error('terminal persistence failed');
    const onFailure = vi.fn();
    const onFinalizationError = vi.fn();

    await finalizePipelineOutcome(Promise.resolve(), {
      onSuccess: async () => {
        throw finalizationError;
      },
      onFailure,
      onFinalizationError,
    });

    expect(onFailure).not.toHaveBeenCalled();
    expect(onFinalizationError).toHaveBeenCalledWith(finalizationError);
  });

  it('handles a pipeline rejection exactly once before finalization', async () => {
    const pipelineError = new Error('pipeline failed');
    const onFailure = vi.fn(async () => undefined);
    const onFinalizationError = vi.fn();

    await finalizePipelineOutcome(Promise.reject(pipelineError), {
      onSuccess: vi.fn(),
      onFailure,
      onFinalizationError,
    });

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(pipelineError);
    expect(onFinalizationError).not.toHaveBeenCalled();
  });
});
