export type AuthSource = 'worker' | 'cors-proxy' | 'bff' | 'external-api';
export type PluginType = 'shape' | 'location' | 'route' | 'spreadsheet' | 'styler';
export type AuthNotificationType = 'AUTH_REQUIRED' | 'AUTH_SUCCESS' | 'AUTH_CANCELLED';

export interface AuthRequiredNotification {
  type: 'AUTH_REQUIRED';
  source: AuthSource;
  context: {
    requestId: string;
    url: string;
    method?: string;
    errorCode: number;
    errorMessage: string;
    sessionId?: string;
    pluginType: PluginType;
    retryCount?: number;
  };
  timestamp: number;
}

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

export interface AuthCancelledNotification {
  type: 'AUTH_CANCELLED';
  context: {
    requestId: string;
    sessionId?: string;
    reason: 'user-cancelled' | 'timeout' | 'error';
  };
  timestamp: number;
}

export type AuthNotification =
  | AuthRequiredNotification
  | AuthSuccessNotification
  | AuthCancelledNotification;

export interface AuthNotificationHandler {
  onAuthRequired(notification: AuthRequiredNotification): Promise<void>;
  onAuthSuccess(notification: AuthSuccessNotification): Promise<void>;
  onAuthCancelled(notification: AuthCancelledNotification): Promise<void>;
}
