import { describe, expect, it } from 'vitest';
import { AuthNotificationFactory, AuthNotificationRegistry } from '@hierarchidb/common-auth';
import { act, renderHook } from '@testing-library/react';
import { useLocationProgress } from '../../hooks/useLocationProgress.js';
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService.js';

describe('useLocationProgress - auth notifications', () => {
  it('emits auth-required and resumed progress events when notifications fire', async () => {
    const svc = new LocationVectorTileService();
    const { result } = renderHook(() => useLocationProgress(svc, 'sess-1', { autoSubscribe: false }));

    const reg = AuthNotificationRegistry.getInstance();
    const authReq = AuthNotificationFactory.createAuthRequired({
      source: 'worker', requestId: 'r1', url: 'https://example.com', method: 'GET', errorCode: 401,
      errorMessage: 'Unauthorized', sessionId: 'sess-1', pluginType: 'shape', retryCount: 0,
    });

    await act(async () => {
      await reg.dispatch(authReq);
    });
    expect(result.current.progress?.stage).toBe('auth-required');

    const success = AuthNotificationFactory.createAuthSuccess({
      requestId: 'r1',
      newToken: 't',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 3600_000,
      sessionId: 'sess-1',
    });
    await act(async () => {
      await reg.dispatch(success);
    });
    expect(result.current.progress?.stage).toBe('resumed');
  });
});
