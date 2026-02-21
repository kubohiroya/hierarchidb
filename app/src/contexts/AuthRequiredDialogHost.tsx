import {
  type AuthCancelledNotification,
  AuthNotificationFactory,
  AuthNotificationRegistry,
  type AuthRequiredNotification,
  type AuthSuccessNotification,
} from '@hierarchidb/auth';
import { AuthRequiredDialog } from '@hierarchidb/ui-plugin-shell/ui-auth';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { treeRouteIds } from '~/router/routes/tree/shared';

const HANDLER_ID = 'app-auth-required-dialog';

type DialogRouteParams = {
  treeId: string;
  pageNodeId?: string;
  targetNodeId?: string;
  nodeType?: string;
  action?: string;
  mode?: string;
  step?: string;
};

export function AuthRequiredDialogHost(): ReactElement | null {
  const registry = AuthNotificationRegistry.getInstance();
  const [notification, setNotification] = useState<AuthRequiredNotification | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const matches = useRouterState({ select: (state) => state.matches });
  const dialogMatch = useMemo(
    () =>
      matches.find(
        (match) =>
          match.routeId === treeRouteIds.dialogModeStep
          || match.routeId === treeRouteIds.dialogMode
          || match.routeId === treeRouteIds.dialog
      ),
    [matches]
  );
  const dialogParams = dialogMatch?.params as DialogRouteParams | undefined;

  const isAuthDebugEnabled = () => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
    } catch {
      return false;
    }
  };

  useEffect(() => {
    registry.register(HANDLER_ID, {
      onAuthRequired: async (next: AuthRequiredNotification) => {
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

  if (!notification) return null;

  const handleSuccess = (
    _token: string,
    _expiresAt: number,
    _userInfo?: {
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
    }
  ) => {
    activeRequestIdRef.current = null;
    setNotification(null);
  };

  const handleCancel = () => {
    const cancelled = AuthNotificationFactory.createAuthCancelled({
      requestId: notification.context.requestId,
      sessionId: notification.context.sessionId,
      reason: 'user-cancelled',
    });
    void registry.dispatch(cancelled);
    activeRequestIdRef.current = null;
    setNotification(null);

    if (notification.context.pluginType === 'shape') {
      const treeId = dialogParams?.treeId;
      const pageNodeId = dialogParams?.pageNodeId;
      const targetNodeId = dialogParams?.targetNodeId;
      const nodeType = dialogParams?.nodeType;
      const action = dialogParams?.action;
      if (treeId && pageNodeId && targetNodeId && nodeType && action) {
        const mode = dialogParams?.mode ?? 'normal';
        void navigate({
          to: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action/$mode/$step',
          params: {
            treeId,
            pageNodeId,
            targetNodeId,
            nodeType,
            action,
            mode,
            step: '2',
          },
          replace: true,
        });
      }
    }
  };

  return (
    <AuthRequiredDialog
      open
      notification={notification}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
      cancelLabel={
        notification.context.pluginType === 'shape' ? 'Cancel (Back to Step 2)' : undefined
      }
    />
  );
}
