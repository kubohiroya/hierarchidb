import {
  type AuthCancelledNotification,
  AuthNotificationFactory,
  AuthNotificationRegistry,
  type AuthRequiredNotification,
  type AuthSuccessNotification,
} from '@hierarchidb/auth';
import { toNodeId, toNodeType, type NodeType } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useEffect, useRef, useState } from 'react';

const HANDLER_ID = 'app-auth-required-dialog';

export type AuthRequiredDialogHostState = {
  notification: AuthRequiredNotification | null;
  handleSuccess: () => void;
  handleCancel: () => void;
};

const isAuthDebugEnabled = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
  } catch {
    return false;
  }
};

export function useAuthRequiredDialogHost(): AuthRequiredDialogHostState {
  const registry = AuthNotificationRegistry.getInstance();
  const workerBridgeRef = useRef(getBuildWorkerBridge());
  const [notification, setNotification] = useState<AuthRequiredNotification | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingRequestsRef = useRef(new Map<string, string>());
  const pendingCountBySessionRef = useRef(new Map<string, number>());

  const resolveSessionTarget = (next: AuthRequiredNotification): { nodeType: NodeType; nodeId: ReturnType<typeof toNodeId> } | null => {
    const rawSessionId = next.context.sessionId;
    if (typeof rawSessionId !== 'string' || rawSessionId.length === 0) {
      return null;
    }
    const pluginType = next.context.pluginType;
    if (pluginType !== 'shape' && pluginType !== 'location' && pluginType !== 'route') {
      return null;
    }
    return {
      nodeType: toNodeType(pluginType),
      nodeId: toNodeId(rawSessionId),
    };
  };

  const handleSuccess = () => {
    activeRequestIdRef.current = null;
    setNotification(null);
  };

  const handleCancel = () => {
    if (!notification) {
      return;
    }

    const cancelled = AuthNotificationFactory.createAuthCancelled({
      requestId: notification.context.requestId,
      sessionId: notification.context.sessionId,
      reason: 'user-cancelled',
    });
    void registry.dispatch(cancelled);
    activeRequestIdRef.current = null;
    setNotification(null);
  };

  useEffect(() => {
    registry.register(HANDLER_ID, {
      onAuthRequired: async (next: AuthRequiredNotification) => {
        const target = resolveSessionTarget(next);
        if (target) {
          const sessionKey = `${target.nodeType}:${target.nodeId}`;
          const count = pendingCountBySessionRef.current.get(sessionKey) ?? 0;
          pendingRequestsRef.current.set(next.context.requestId, sessionKey);
          pendingCountBySessionRef.current.set(sessionKey, count + 1);
          if (count === 0) {
            try {
              await workerBridgeRef.current.pauseBuildSession(
                target.nodeType,
                target.nodeId,
                'auth-required',
              );
            } catch (error) {
              console.warn('[auth][ui] failed to pause build session on auth required', error);
            }
          }
        }
        if (isAuthDebugEnabled()) {
          console.debug('[auth][ui] AUTH_REQUIRED received', {
            requestId: next.context.requestId,
            pluginType: next.context.pluginType,
            url: next.context.url,
          });
        }
        activeRequestIdRef.current = next.context.requestId;
        setNotification(next);
      },
      onAuthSuccess: async (next: AuthSuccessNotification) => {
        const sessionKey = pendingRequestsRef.current.get(next.context.requestId);
        if (sessionKey) {
          pendingRequestsRef.current.delete(next.context.requestId);
          const currentCount = pendingCountBySessionRef.current.get(sessionKey) ?? 0;
          const nextCount = Math.max(0, currentCount - 1);
          if (nextCount === 0) {
            pendingCountBySessionRef.current.delete(sessionKey);
            const separator = sessionKey.indexOf(':');
            if (separator <= 0 || separator >= sessionKey.length - 1) {
              return;
            }
            const nodeType = toNodeType(sessionKey.slice(0, separator));
            const nodeId = toNodeId(sessionKey.slice(separator + 1));
            try {
              await workerBridgeRef.current.startBuildSession(nodeType, nodeId, undefined);
            } catch (error) {
              console.warn('[auth][ui] failed to restart build session on auth success', error);
            }
          } else {
            pendingCountBySessionRef.current.set(sessionKey, nextCount);
          }
        }
        if (activeRequestIdRef.current === next.context.requestId) {
          if (isAuthDebugEnabled()) {
            console.debug('[auth][ui] AUTH_SUCCESS received', {
              requestId: next.context.requestId,
            });
          }
          activeRequestIdRef.current = null;
          setNotification(null);
        }
      },
      onAuthCancelled: async (next: AuthCancelledNotification) => {
        const sessionKey = pendingRequestsRef.current.get(next.context.requestId);
        if (sessionKey) {
          pendingRequestsRef.current.delete(next.context.requestId);
          const currentCount = pendingCountBySessionRef.current.get(sessionKey) ?? 0;
          const nextCount = Math.max(0, currentCount - 1);
          if (nextCount === 0) {
            pendingCountBySessionRef.current.delete(sessionKey);
          } else {
            pendingCountBySessionRef.current.set(sessionKey, nextCount);
          }
        }
        if (activeRequestIdRef.current === next.context.requestId) {
          if (isAuthDebugEnabled()) {
            console.debug('[auth][ui] AUTH_CANCELLED received', {
              requestId: next.context.requestId,
              reason: next.context.reason,
            });
          }
          activeRequestIdRef.current = null;
          setNotification(null);
        }
      },
    });

    return () => {
      registry.unregister(HANDLER_ID);
    };
  }, [registry]);

  return {
    notification,
    handleSuccess,
    handleCancel,
  };
}
