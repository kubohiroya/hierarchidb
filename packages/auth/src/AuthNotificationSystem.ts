/**
 * @file AuthNotificationSystem.ts
 * @description Authentication notification system for Worker-to-UI communication
 *
 * This system handles authentication errors that occur during build processing
 * in Worker threads and coordinates with the UI layer for authentication flows.
 */

import type {
  AuthCancelledNotification,
  AuthNotification,
  AuthNotificationHandler,
  AuthRequiredNotification,
  AuthSource,
  AuthSuccessNotification,
  StorageWarningNotification,
} from '@hierarchidb/auth-api';

/**
 * Central registry for authentication notification handlers
 */
export class AuthNotificationRegistry {
  private static instance: AuthNotificationRegistry;
  private handlers = new Map<string, AuthNotificationHandler>();
  private pendingRequests = new Map<string, AuthRequiredNotification>();

  // Bridge notifications across Worker/UI via BroadcastChannel (same-origin, same-tab).
  private readonly broadcastChannelName = 'hierarchidb:auth-notifications:v1';
  private bc?: BroadcastChannel;
  private selfId = `auth-reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  static getInstance(): AuthNotificationRegistry {
    if (!AuthNotificationRegistry.instance) {
      AuthNotificationRegistry.instance = new AuthNotificationRegistry();
    }
    return AuthNotificationRegistry.instance;
  }

  private constructor() {
    // Best-effort: BroadcastChannel is not available in all environments.
    if (typeof BroadcastChannel === 'function') {
      this.bc = new BroadcastChannel(this.broadcastChannelName);
      this.bc.onmessage = (event: MessageEvent) => {
        const data = event.data as
          | { sourceId?: string; notification?: AuthNotification }
          | undefined;
        if (!data?.notification) return;
        if (data.sourceId && data.sourceId === this.selfId) return; // ignore echo
        // Re-dispatch locally without re-broadcasting.
        void this.dispatch(data.notification, { broadcast: false });
      };
    }
  }

  /**
   * Register an authentication notification handler
   */
  register(handlerId: string, handler: AuthNotificationHandler): void {
    this.handlers.set(handlerId, handler);

    // Replay pending AUTH_REQUIRED so late-registered UI handlers (e.g. during app boot)
    // can still prompt the user instead of leaving callers stuck waiting.
    for (const pending of this.pendingRequests.values()) {
      void handler.onAuthRequired(pending);
    }
  }

  /**
   * Unregister an authentication notification handler
   */
  unregister(handlerId: string): void {
    this.handlers.delete(handlerId);
  }

  /**
   * Dispatch an authentication notification to all registered handlers
   */
  async dispatch(
    notification: AuthNotification,
    opts: { broadcast?: boolean } = {}
  ): Promise<void> {
    const broadcast = opts.broadcast ?? true;

    if (isAuthDebugEnabled()) {
      const handlerIds = Array.from(this.handlers.keys());
      // Keep logs compact but actionable.
      console.debug('[auth][registry] dispatch', {
        type: notification.type,
        requestId: (
          notification as
            | AuthRequiredNotification
            | AuthSuccessNotification
            | AuthCancelledNotification
        ).context.requestId,
        broadcast,
        handlerCount: handlerIds.length,
        handlers: handlerIds,
        pluginType:
          notification.type === 'AUTH_REQUIRED' ? notification.context.pluginType : undefined,
        url: notification.type === 'AUTH_REQUIRED' ? notification.context.url : undefined,
      });
    }

    // Track pending requests
    if (notification.type === 'AUTH_REQUIRED') {
      this.pendingRequests.set(notification.context.requestId, notification);
    } else if (notification.type === 'AUTH_SUCCESS' || notification.type === 'AUTH_CANCELLED') {
      this.pendingRequests.delete(notification.context.requestId);
    }

    // Broadcast to other contexts first (so UI can react even if this context is a worker)
    if (broadcast && this.bc) {
      try {
        this.bc.postMessage({ sourceId: this.selfId, notification });
      } catch {
        // ignore
      }
    }

    // Dispatch to all handlers in this context
    const promises = Array.from(this.handlers.values()).map((handler) => {
      switch (notification.type) {
        case 'AUTH_REQUIRED':
          return handler.onAuthRequired(notification);
        case 'AUTH_SUCCESS':
          return handler.onAuthSuccess(notification);
        case 'AUTH_CANCELLED':
          return handler.onAuthCancelled(notification);
        case 'STORAGE_WARNING':
          return handler.onStorageWarning?.(notification) ?? Promise.resolve();
        default:
          return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);
  }
}

/**
 * Utility functions for creating authentication notifications
 */
export const AuthNotificationFactory = {
  /**
   * Create an authentication required notification
   */
  createAuthRequired(params: {
    source: AuthSource;
    requestId: string;
    url: string;
    method?: string;
    errorCode: number;
    errorMessage: string;
    sessionId?: string;
    sessionStartedAt?: number;
    pluginType: AuthRequiredNotification['context']['pluginType'];
    retryCount?: number;
  }): AuthRequiredNotification {
    return {
      type: 'AUTH_REQUIRED',
      source: params.source,
      context: {
        requestId: params.requestId,
        url: params.url,
        method: params.method || 'GET',
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        sessionId: params.sessionId,
        sessionStartedAt: params.sessionStartedAt,
        pluginType: params.pluginType,
        retryCount: params.retryCount || 0,
      },
      timestamp: Date.now(),
    };
  },

  /**
   * Create an authentication success notification
   */
  createAuthSuccess(params: {
    requestId: string;
    newToken: string;
    tokenType?: 'Bearer' | 'Basic';
    expiresAt: number;
    sessionId?: string;
    userInfo?: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };
  }): AuthSuccessNotification {
    return {
      type: 'AUTH_SUCCESS',
      context: {
        requestId: params.requestId,
        newToken: params.newToken,
        tokenType: params.tokenType || 'Bearer',
        expiresAt: params.expiresAt,
        sessionId: params.sessionId,
        userInfo: params.userInfo,
      },
      timestamp: Date.now(),
    };
  },

  /**
   * Create an authentication cancelled notification
   */
  createAuthCancelled(params: {
    requestId: string;
    sessionId?: string;
    reason: 'user-cancelled' | 'timeout' | 'error';
  }): AuthCancelledNotification {
    return {
      type: 'AUTH_CANCELLED',
      context: {
        requestId: params.requestId,
        sessionId: params.sessionId,
        reason: params.reason,
      },
      timestamp: Date.now(),
    };
  },

  /**
   * Create a storage warning notification
   */
  createStorageWarning(params: { message: string; timestamp: number }): StorageWarningNotification {
    return {
      type: 'STORAGE_WARNING',
      context: {
        message: params.message,
        timestamp: params.timestamp,
      },
      timestamp: Date.now(),
    };
  },
};

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `auth-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract authentication source from HTTP response
 */
export function detectAuthSource(response: Response): AuthSource {
  const url = response.url;

  if (url.includes('cors-proxy')) {
    return 'cors-proxy';
  } else if (url.includes('bff') || url.includes('/auth/')) {
    return 'bff';
  } else if (url.startsWith('http') && !url.includes('localhost')) {
    return 'external-api';
  } else {
    return 'worker';
  }
}

/**
 * Type guards for authentication notifications
 */
export const AuthNotificationGuards = {
  isAuthRequired(notification: AuthNotification): notification is AuthRequiredNotification {
    return notification.type === 'AUTH_REQUIRED';
  },

  isAuthSuccess(notification: AuthNotification): notification is AuthSuccessNotification {
    return notification.type === 'AUTH_SUCCESS';
  },

  isAuthCancelled(notification: AuthNotification): notification is AuthCancelledNotification {
    return notification.type === 'AUTH_CANCELLED';
  },
};

/**
 * Constants for authentication system
 */
export const AUTH_CONSTANTS = {
  DEFAULT_TIMEOUT: 300000, // 5 minutes
  MAX_RETRY_COUNT: 3,
  TOKEN_REFRESH_THRESHOLD: 300000, // 5 minutes before expiry
} as const;

/**
 * Debugging utilities for authentication system
 */
const isAuthDebugEnabled = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
  } catch {
    return false;
  }
};
