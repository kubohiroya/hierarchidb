import { describe, expect, it, vi } from 'vitest';
import { AuthNotificationFactory, AuthNotificationRegistry } from '@hierarchidb/auth';
import { toNodeId } from '@hierarchidb/core-types';
import { act, renderHook } from '@testing-library/react';
import { useLocationProgress } from '~/common/hooks/useLocationProgress';

const bridgeMock = {
  initialize: vi.fn().mockResolvedValue(undefined),
  subscribeBuildProgress: vi.fn().mockResolvedValue(() => {
  }),
  getBuildSessionStatus: vi.fn(),
};

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getBuildWorkerBridge: () => bridgeMock,
}));

describe('useLocationProgress - auth notifications', () => {
  it('emits auth-required and resumed progress events when notifications fire', async () => {
    const { result } = renderHook(() => useLocationProgress(toNodeId('node-1'), { autoSubscribe: false }));

    const reg = AuthNotificationRegistry.getInstance();
    const authReq = AuthNotificationFactory.createAuthRequired({
      source: 'worker', requestId: 'r1', url: 'https://example.com', method: 'GET', errorCode: 401,
      errorMessage: 'Unauthorized', sessionId: 'sess-1', pluginType: 'shape', retryCount: 0,
    });

    await act(async () => {
      await reg.dispatch(authReq);
    });
    expect(result.current.progress?.taskType).toBe('auth-required');

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
    expect(result.current.progress?.taskType).toBe('resumed');
  });
});
