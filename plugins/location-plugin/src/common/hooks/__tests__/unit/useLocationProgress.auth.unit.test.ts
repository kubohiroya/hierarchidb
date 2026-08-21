import { AuthNotificationFactory, AuthNotificationRegistry } from '@hierarchidb/auth';
import { toNodeId } from '@hierarchidb/core-types';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocationProgress } from '../../useLocationProgress';

const bridgeMock = {
  initialize: vi.fn().mockResolvedValue(undefined),
  getBuildSessionStatus: vi.fn(),
};

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getBuildWorkerBridge: () => bridgeMock,
}));

describe('useLocationProgress - auth notifications', () => {
  it('keeps auth notices separate from canonical task progress', async () => {
    const { result } = renderHook(() =>
      useLocationProgress(toNodeId('node-1'), { autoSubscribe: false })
    );

    const reg = AuthNotificationRegistry.getInstance();
    const authReq = AuthNotificationFactory.createAuthRequired({
      source: 'worker',
      requestId: 'r1',
      url: 'https://example.com',
      method: 'GET',
      errorCode: 401,
      errorMessage: 'Unauthorized',
      sessionId: 'node-1',
      pluginType: 'location',
      retryCount: 0,
    });

    await act(async () => {
      await reg.dispatch(authReq);
    });
    expect(result.current.progress).toBeNull();
    expect(result.current.authNotice).toMatchObject({
      state: 'required',
      message: 'Unauthorized',
    });

    const success = AuthNotificationFactory.createAuthSuccess({
      requestId: 'r1',
      newToken: 't',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 3600_000,
      sessionId: 'node-1',
    });
    await act(async () => {
      await reg.dispatch(success);
    });
    expect(result.current.progress).toBeNull();
    expect(result.current.authNotice).toMatchObject({
      state: 'resumed',
      message: 'Authentication successful - resuming',
    });
  });

  it('ignores other plugins, sessions, and unrelated completion notifications', async () => {
    const { result } = renderHook(() =>
      useLocationProgress(toNodeId('node-1'), { autoSubscribe: false })
    );
    const reg = AuthNotificationRegistry.getInstance();

    const shapeRequest = AuthNotificationFactory.createAuthRequired({
      source: 'worker',
      requestId: 'shape-request',
      url: 'https://example.com/shape',
      errorCode: 401,
      errorMessage: 'Shape auth required',
      sessionId: 'node-1',
      pluginType: 'shape',
    });
    const otherLocationSession = AuthNotificationFactory.createAuthRequired({
      source: 'worker',
      requestId: 'other-location-request',
      url: 'https://example.com/location',
      errorCode: 401,
      errorMessage: 'Other location auth required',
      sessionId: 'node-2',
      pluginType: 'location',
    });
    const unrelatedSuccess = AuthNotificationFactory.createAuthSuccess({
      requestId: 'unrelated-success',
      newToken: 'token',
      expiresAt: Date.now() + 3_600_000,
      sessionId: 'node-1',
    });

    await act(async () => {
      await reg.dispatch(shapeRequest);
      await reg.dispatch(otherLocationSession);
      await reg.dispatch(unrelatedSuccess);
    });

    expect(result.current.authNotice).toBeNull();
  });

  it('keeps the required notice until every accepted request is resolved', async () => {
    const { result } = renderHook(() =>
      useLocationProgress(toNodeId('node-1'), { autoSubscribe: false })
    );
    const reg = AuthNotificationRegistry.getInstance();
    const createRequest = (requestId: string) =>
      AuthNotificationFactory.createAuthRequired({
        source: 'worker',
        requestId,
        url: `https://example.com/${requestId}`,
        errorCode: 401,
        errorMessage: `Authentication required for ${requestId}`,
        sessionId: 'node-1',
        pluginType: 'location',
      });
    const createSuccess = (requestId: string) =>
      AuthNotificationFactory.createAuthSuccess({
        requestId,
        newToken: 'token',
        expiresAt: Date.now() + 3_600_000,
        sessionId: 'node-1',
      });

    await act(async () => {
      await reg.dispatch(createRequest('location-request-1'));
      await reg.dispatch(createRequest('location-request-2'));
      await reg.dispatch(createSuccess('location-request-1'));
    });
    expect(result.current.authNotice?.state).toBe('required');

    await act(async () => {
      await reg.dispatch(createSuccess('location-request-2'));
    });
    expect(result.current.authNotice?.state).toBe('resumed');
  });
});
