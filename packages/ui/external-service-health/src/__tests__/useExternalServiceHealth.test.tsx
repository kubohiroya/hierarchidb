import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ExternalServiceHealthChecker } from '../externalServiceHealthTypes.js';
import { useExternalServiceHealth } from '../useExternalServiceHealth.js';

describe('useExternalServiceHealth', () => {
  it('keeps stale health responses from replacing the latest input result', async () => {
    const resolvers: Array<(status: 'healthy' | 'incompatible') => void> = [];
    const checker: ExternalServiceHealthChecker<{ readonly id: string }> = {
      checkHealth: vi.fn(
        () =>
          new Promise((resolve) => {
            resolvers.push((status) => resolve({ status }));
          })
      ),
    };

    const { result, rerender } = renderHook(
      ({ value }) => useExternalServiceHealth({ checker, value, debounceMs: 10 }),
      { initialProps: { value: { id: 'first' } } }
    );

    await waitFor(() => expect(checker.checkHealth).toHaveBeenCalledTimes(1));
    rerender({ value: { id: 'second' } });
    await waitFor(() => expect(checker.checkHealth).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolvers[1]?.('incompatible');
      resolvers[0]?.('healthy');
    });

    await waitFor(() => expect(result.current.status).toBe('incompatible'));
    expect(result.current.status).toBe('incompatible');
  });

  it('maps checker exceptions to unhealthy with a stable code', async () => {
    const checker: ExternalServiceHealthChecker<{ readonly id: string }> = {
      checkHealth: vi.fn().mockRejectedValue(new Error('raw endpoint failure')),
    };

    const { result } = renderHook(() =>
      useExternalServiceHealth({
        checker,
        value: { id: 'target' },
        debounceMs: 10,
        unavailableCode: 'CONNECTION_UNAVAILABLE',
      })
    );

    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'unhealthy',
        code: 'CONNECTION_UNAVAILABLE',
      })
    );
  });
});
