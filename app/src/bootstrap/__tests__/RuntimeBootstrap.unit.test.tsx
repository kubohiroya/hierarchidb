import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RuntimeBootstrap,
  type RuntimeBootstrapOperations,
  type RuntimeBootstrapResult,
} from '../RuntimeBootstrap.js';

const createDeferred = <T,>() => {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: (value: T) => {
      if (!resolvePromise) throw new Error('deferred-resolve-unavailable');
      resolvePromise(value);
    },
    reject: (reason: unknown) => {
      if (!rejectPromise) throw new Error('deferred-reject-unavailable');
      rejectPromise(reason);
    },
  };
};

const createOperations = <TRuntime,>(
  initializeRuntime: () => Promise<RuntimeBootstrapResult<TRuntime>>,
  renderReadyRuntime: RuntimeBootstrapOperations<TRuntime>['renderReadyRuntime']
): RuntimeBootstrapOperations<TRuntime> => ({
  initializeRuntime,
  renderReadyRuntime,
  handleBootstrapFailure: vi.fn(),
  handleUnhandledRejection: vi.fn(),
});

describe('RuntimeBootstrap', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps the provider tree unmounted while activation requests a reload', async () => {
    const renderReadyRuntime = vi.fn(() => <div data-testid="provider-tree" />);
    const initializeRuntime = vi.fn(async () => ({ status: 'reload-requested' }) as const);
    const operations = createOperations(initializeRuntime, renderReadyRuntime);

    render(<RuntimeBootstrap operations={operations} />);

    await waitFor(() => expect(initializeRuntime).toHaveBeenCalledOnce());
    expect(renderReadyRuntime).not.toHaveBeenCalled();
    expect(screen.queryByTestId('provider-tree')).toBeNull();
  });

  it('keeps the provider tree unmounted and reports a terminal bootstrap failure', async () => {
    const failure = new Error('canonical-runtime-worker-not-ready');
    const renderReadyRuntime = vi.fn(() => <div data-testid="provider-tree" />);
    const operations = createOperations(async () => {
      throw failure;
    }, renderReadyRuntime);

    render(<RuntimeBootstrap operations={operations} />);

    await waitFor(() => expect(operations.handleBootstrapFailure).toHaveBeenCalledWith(failure));
    expect(renderReadyRuntime).not.toHaveBeenCalled();
    expect(screen.queryByTestId('provider-tree')).toBeNull();
  });

  it('mounts one provider tree only after the successor runtime is ready', async () => {
    const order: string[] = [];
    const deferred = createDeferred<RuntimeBootstrapResult<string>>();
    const initializeRuntime = vi.fn(() => {
      order.push('bootstrap:start');
      return deferred.promise;
    });
    const ProviderTree = ({ runtime }: { runtime: string }) => {
      useEffect(() => {
        order.push('provider:mounted');
      }, []);
      return <div data-testid="provider-tree">{runtime}</div>;
    };
    const renderReadyRuntime = vi.fn((runtime: string) => {
      order.push('provider:render');
      return <ProviderTree runtime={runtime} />;
    });
    const operations = createOperations(initializeRuntime, renderReadyRuntime);

    render(<RuntimeBootstrap operations={operations} />);

    expect(order).toEqual(['bootstrap:start']);
    expect(screen.queryByTestId('provider-tree')).toBeNull();

    await act(async () => {
      order.push('bootstrap:ready');
      deferred.resolve({ status: 'runtime-ready', runtime: 'router' });
      await deferred.promise;
    });

    await waitFor(() => expect(screen.getByTestId('provider-tree').textContent).toBe('router'));
    expect(renderReadyRuntime).toHaveBeenCalledOnce();
    expect(order).toEqual([
      'bootstrap:start',
      'bootstrap:ready',
      'provider:render',
      'provider:mounted',
    ]);
  });
});
