import { describe, expect, it } from 'vitest';
import { RouteBatchManager } from '../../src/services/RouteBatchManager';

describe('RouteBatchManager idempotency', () => {
  it('returns the same sessionId for identical input payload', async () => {
    const mgr = new (RouteBatchManager as any)();
    const cfg = {
      routeGeneration: {
        method: 'direct',
        parallel: true,
        maxConcurrent: 2,
        retryOnFailure: false,
        maxRetries: 0,
      },
    } as any;
    const routes = [{
      startCoordinates: [0, 0] as [number, number],
      endCoordinates: [1, 1] as [number, number],
      method: 'direct',
    }];
    const a = await mgr.startRouteBatchSession('n1', cfg, routes);
    const b = await mgr.startRouteBatchSession('n1', cfg, routes);
    expect(a).toBe(b);
  });
});

