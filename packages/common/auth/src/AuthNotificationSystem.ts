/**
 * @file AuthNotificationSystem.ts
 * @description Common authentication notification system for Worker-to-UI communication
 * 
 * This system handles authentication errors that occur during batch processing
 * in Worker threads and coordinates with the UI layer for authentication flows.
 */

export type AuthSource = 'worker' | 'cors-proxy' | 'bff' | 'external-api';
export type PluginType = 'shape' | 'spreadsheet' | 'styler';
export type AuthNotificationType = 'AUTH_REQUIRED' | 'AUTH_SUCCESS' | 'AUTH_CANCELLED';

/**
 * Notification sent when authentication is required to continue processing
 */
export interface AuthRequiredNotification {
  type: 'AUTH_REQUIRED';
  source: AuthSource;
  context: {
    requestId: string;
    url: string;
    method?: string;
    errorCode: number;
    errorMessage: string;
    sessionId?: string;  // Batch processing session
    pluginType: PluginType;
    retryCount?: number;
  };
  timestamp: number;
}

/**
 * Notification sent when authentication succeeds
 */
export interface AuthSuccessNotification {
  type: 'AUTH_SUCCESS';
  context: {
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
  };
  timestamp: number;
}

/**
 * Notification sent when authentication is cancelled
 */
export interface AuthCancelledNotification {
  type: 'AUTH_CANCELLED';
  context: {
    requestId: string;
    sessionId?: string;
    reason: 'user-cancelled' | 'timeout' | 'error';
  };
  timestamp: number;
}

/**
 * Union type for all authentication notifications
 */
export type AuthNotification = 
  | AuthRequiredNotification 
  | AuthSuccessNotification 
  | AuthCancelledNotification;

/**
 * Interface for handling authentication notifications
 */
export interface AuthNotificationHandler {
  /**
   * Handle authentication required notification
   */
  onAuthRequired(notification: AuthRequiredNotification): Promise<void>;
  
  /**
   * Handle authentication success notification
   */
  onAuthSuccess(notification: AuthSuccessNotification): Promise<void>;
  
  /**
   * Handle authentication cancelled notification
   */
  onAuthCancelled(notification: AuthCancelledNotification): Promise<void>;
}

/**
 * Central registry for authentication notification handlers
 */
export class AuthNotificationRegistry {
  private static instance: AuthNotificationRegistry;
  private handlers = new Map<string, AuthNotificationHandler>();
  private pendingRequests = new Map<string, AuthRequiredNotification>();
  
  static getInstance(): AuthNotificationRegistry {
    if (!AuthNotificationRegistry.instance) {
      AuthNotificationRegistry.instance = new AuthNotificationRegistry();
    }
    return AuthNotificationRegistry.instance;
  }
  
  /**
   * Register an authentication notification handler
   */
  register(handlerId: string, handler: AuthNotificationHandler): void {
    this.handlers.set(handlerId, handler);
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
  async dispatch(notification: AuthNotification): Promise<void> {
    // Track pending requests
    if (notification.type === 'AUTH_REQUIRED') {
      this.pendingRequests.set(notification.context.requestId, notification);
    } else {
      this.pendingRequests.delete(notification.context.requestId);
    }
    
    // Dispatch to all handlers
    const promises = Array.from(this.handlers.values()).map(handler => {
      switch (notification.type) {
        case 'AUTH_REQUIRED':
          return handler.onAuthRequired(notification);
        case 'AUTH_SUCCESS':
          return handler.onAuthSuccess(notification);
        case 'AUTH_CANCELLED':
          return handler.onAuthCancelled(notification);
      }
    });
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Get pending authentication requests
   */
  getPendingRequests(): AuthRequiredNotification[] {
    return Array.from(this.pendingRequests.values());
  }
  
  /**
   * Check if a request is pending
   */
  isPending(requestId: string): boolean {
    return this.pendingRequests.has(requestId);
  }
  
  /**
   * Clear all pending requests
   */
  clearPendingRequests(): void {
    this.pendingRequests.clear();
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
    pluginType: PluginType;
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

export default AuthNotificationRegistry;