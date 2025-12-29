/**
 * @file WorkerAuthHandler.ts
 * @description Authentication handler for Shape Plugin batch processing
 *
 * Handles authentication errors during batch processing and coordinates
 * with UI layer for authentication flows.
 */

import {
  AUTH_CONSTANTS,
  type AuthCancelledNotification,
  type AuthNotification,
  AuthNotificationFactory,
  AuthNotificationRegistry,
  type AuthRequiredNotification,
  type AuthSuccessNotification,
  detectAuthSource,
  generateRequestId,
} from '@hierarchidb/common-auth';
import * as Comlink from 'comlink';

export interface AuthContext {
  nodeId?: string;
  pluginType: 'shape' | 'spreadsheet' | 'styler';
  maxRetries?: number;
}

export interface AuthRequestInfo {
  requestId: string;
  url: string;
  init: RequestInit;
  context: AuthContext;
  retryCount: number;
  createdAt: number;
  maxRetries: number;
}

/**
 * Worker-side authentication handler for batch processing
 */
export class WorkerAuthHandler {
  private authCallbacks = new Map<string, {
    resolve: (response: Response) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    requestInfo: AuthRequestInfo;
  }>();

  private notificationRegistry = AuthNotificationRegistry.getInstance();
  private uiNotificationCallback?: (notification: AuthNotification) => void;
  private currentToken?: { token: string; type: 'Bearer' | 'Basic'; expiresAt?: number };

  constructor() {
    // Register this handler with the notification registry
    this.notificationRegistry.register('worker-auth-handler', {
      onAuthRequired: this.handleAuthRequired.bind(this),
      onAuthSuccess: this.handleAuthSuccess.bind(this),
      onAuthCancelled: this.handleAuthCancelled.bind(this),
    });
  }

  /** Current state of authentication handler */
  private currentState: 'idle' | 'waiting' | 'processing' = 'idle';

  /** Session IDs currently waiting for authentication */
  private waitingNodes: Set<string> = new Set();

  /**
   * Add session to waiting state
   */
  private addWaitingNode(nodeId: string): void {
    this.waitingNodes.add(nodeId);
    this.currentState = 'waiting';
    console.log(`🔐 Node ${nodeId} added to waiting for auth`);
  }

  /**
   * Remove session from waiting state
   */
  private removeWaitingNode(nodeId: string): void {
    this.waitingNodes.delete(nodeId);
    if (this.waitingNodes.size === 0) {
      this.currentState = 'idle';
    }
    console.log(`✅ Node ${nodeId} removed from waiting for auth`);
  }

  /**
   * Get current authentication state
   */
  getAuthState(): {
    state: 'idle' | 'waiting' | 'processing';
    waitingNodes: string[];
    activeRequests: number;
  } {
    return {
      state: this.currentState,
      waitingNodes: Array.from(this.waitingNodes),
      activeRequests: this.authCallbacks.size,
    };
  }

  /**
   * Set callback for sending notifications to UI layer
   */
  setUINotificationCallback(callback: (notification: AuthNotification) => void): void {
    this.uiNotificationCallback = Comlink.proxy(callback);
  }

  /**
   * Execute HTTP request with automatic authentication error handling
   */
  async fetchWithAuth(
    url: string,
    init: RequestInit = {},
    context: AuthContext,
  ): Promise<Response> {
    const requestId = generateRequestId();
    const maxRetries = context.maxRetries ?? AUTH_CONSTANTS.MAX_RETRY_COUNT;

    return this.executeRequestWithRetry(url, init, context, requestId, 0, maxRetries);
  }

  /**
   * Execute request with retry logic
   */
  private async executeRequestWithRetry(
    url: string,
    init: RequestInit,
    context: AuthContext,
    requestId: string,
    retryCount: number,
    maxRetries: number,
  ): Promise<Response> {
    try {
      console.log(`🔐 Executing request (attempt ${retryCount + 1}): ${url}`);

      const response = await fetch(url, init);

      if (response.status === 401) {
        console.warn(`🚨 Authentication error (401) for: ${url}`);

        if (retryCount >= maxRetries) {
          throw new Error(`Authentication failed after ${maxRetries + 1} attempts`);
        }

        // Create auth required notification
        const authNotification = AuthNotificationFactory.createAuthRequired({
          source: detectAuthSource(response),
          requestId,
          url,
          method: init.method || 'GET',
          errorCode: response.status,
          errorMessage: await this.extractErrorMessage(response),
          nodeId: context.nodeId,
          pluginType: context.pluginType,
          retryCount,
        });

        // Wait for authentication and retry
        return this.waitForAuthAndRetry(
          authNotification,
          url,
          init,
          context,
          requestId,
          retryCount + 1,
          maxRetries,
        );
      }

      // Success case
      console.log(`✅ Request successful: ${url} (${response.status})`);
      return response;

    } catch (error) {
      console.error(`❌ Request failed: ${url}`, error);

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Network error - may indicate CORS/auth issues
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying due to network error (attempt ${retryCount + 2})`);

          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));

          return this.executeRequestWithRetry(
            url, init, context, requestId, retryCount + 1, maxRetries,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Wait for authentication completion and retry request
   */
  /**
   * Wait for authentication completion and retry request
   */
  private async waitForAuthAndRetry(
    authNotification: AuthRequiredNotification,
    url: string,
    init: RequestInit,
    context: AuthContext,
    requestId: string,
    retryCount: number,
    maxRetries: number,
  ): Promise<Response> {
    // Add session to waiting state if provided
    if (context.nodeId) {
      this.addWaitingNode(context.nodeId);
    }

    return new Promise<Response>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.authCallbacks.delete(requestId);
        // Remove from waiting state on timeout
        if (context.nodeId) {
          this.removeWaitingNode(context.nodeId);
        }
        reject(new Error('Authentication timeout'));
      }, AUTH_CONSTANTS.DEFAULT_TIMEOUT);

      // Store callback for when authentication completes
      this.authCallbacks.set(requestId, {
        resolve,
        reject,
        timeout,
        requestInfo: {
          requestId,
          url,
          init,
          context,
          retryCount,
          maxRetries,
          createdAt: Date.now(),
        },
      });

      console.log(`⏳ Waiting for authentication: ${requestId}`);

      // Send auth notification to UI
      if (this.uiNotificationCallback) {
        this.uiNotificationCallback(authNotification);
      } else {
        console.warn('⚠️ No UI notification callback set - authentication cannot be handled');
        this.authCallbacks.delete(requestId);
        clearTimeout(timeout);
        // Remove from waiting state if no UI callback
        if (context.nodeId) {
          this.removeWaitingNode(context.nodeId);
        }
        reject(new Error('No UI notification callback available'));
      }
    });
  }

  /**
   * Handle authentication required event
   */
  private async handleAuthRequired(notification: AuthRequiredNotification): Promise<void> {
    console.log(`🔐 Auth required for request: ${notification.context.requestId}`);
    // This is handled by waitForAuthAndRetry, so just log it
  }

  /**
   * Handle authentication success event
   */
  /**
   * Handle authentication success notification from UI
   */
  private async handleAuthSuccess(notification: AuthSuccessNotification): Promise<void> {
    const { requestId, newToken, tokenType = 'Bearer', nodeId } = notification.context;
    const callback = this.authCallbacks.get(requestId);

    if (!callback) {
      console.warn(`⚠️ No callback found for auth success: ${requestId}`);
      return;
    }

    console.log(`✅ Auth success for request: ${requestId}`);

    const { resolve, reject, timeout, requestInfo } = callback;
    clearTimeout(timeout);
    this.authCallbacks.delete(requestId);

    // Remove session from waiting state
    if (nodeId) {
      this.removeWaitingNode(nodeId);
    }

    try {
      // Remember latest token for subsequent requests
      this.currentToken = { token: newToken, type: tokenType, expiresAt: notification.context.expiresAt };
      // Update request headers with new token
      const newInit: RequestInit = {
        ...requestInfo.init,
        headers: {
          ...requestInfo.init.headers,
          'Authorization': `${tokenType} ${newToken}`,
        },
      };

      // Retry the original request with new token
      const response = await this.executeRequestWithRetry(
        requestInfo.url,
        newInit,
        requestInfo.context,
        requestInfo.requestId,
        requestInfo.retryCount,
        requestInfo.context.maxRetries ?? AUTH_CONSTANTS.MAX_RETRY_COUNT,
      );

      resolve(response);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Request failed after auth'));
    }
  }

  /**
   * Explicitly seed or update the auth token from UI or other system
   */
  setToken(token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number): void {
    this.currentToken = { token, type, expiresAt };
  }

  /**
   * Return headers to be attached to outbound requests
   */
  getAuthHeaders(): Record<string, string> {
    if (this.currentToken?.token) {
      return { Authorization: `${this.currentToken.type} ${this.currentToken.token}` };
    }
    return {};
  }

  /**
   * Handle authentication cancelled event
   */
  /**
   * Handle authentication cancellation notification from UI
   */
  private async handleAuthCancelled(notification: AuthCancelledNotification): Promise<void> {
    const { requestId, reason, nodeId } = notification.context;
    const callback = this.authCallbacks.get(requestId);

    if (!callback) {
      console.warn(`⚠️ No callback found for auth cancellation: ${requestId}`);
      return;
    }

    console.log(`❌ Auth cancelled for request: ${requestId}, reason: ${reason}`);

    const { reject, timeout } = callback;
    clearTimeout(timeout);
    this.authCallbacks.delete(requestId);

    // Remove session from waiting state
    if (nodeId) {
      this.removeWaitingNode(nodeId);
    }

    // Reject the request with cancellation error
    reject(new Error(`Authentication cancelled: ${reason}`));
  }

  /**
   * Send notification to UI layer
   */
  private notifyUI(notification: AuthNotification): void {
    if (this.uiNotificationCallback) {
      try {
        console.log(`📡 Sending notification to UI:`, notification.type);
        this.uiNotificationCallback(notification);
      } catch (error) {
        console.error('Failed to send notification to UI:', error);
      }
    } else {
      console.warn('⚠️ No UI notification callback registered');
    }
  }

  /**
   * Extract error message from response
   */
  private async extractErrorMessage(response: Response): Promise<string> {
    try {
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const errorData = await response.json();
        return errorData.error || errorData.message || 'Authentication required';
      } else {
        const text = await response.text();
        return text || 'Authentication required';
      }
    } catch {
      return 'Authentication required';
    }
  }

  /**
   * Get pending authentication requests
   */
  getPendingRequests(): AuthRequestInfo[] {
    return Array.from(this.authCallbacks.values()).map(callback => callback.requestInfo);
  }

  /**
   * Cancel all pending authentication requests
   */
  cancelAllPendingRequests(reason: string = 'cancelled'): void {
    const callbacks = Array.from(this.authCallbacks.values());

    console.log(`🚫 Cancelling ${callbacks.length} pending auth requests`);

    for (const { reject, timeout, requestInfo } of callbacks) {
      clearTimeout(timeout);
      reject(new Error(`Request cancelled: ${reason}`));

      // Send cancellation notification
      const cancelNotification = AuthNotificationFactory.createAuthCancelled({
        requestId: requestInfo.requestId,
        nodeId: requestInfo.context.nodeId,
        reason: 'error',
      });

      this.notifyUI(cancelNotification);
    }

    this.authCallbacks.clear();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.cancelAllPendingRequests('handler-disposed');
    this.notificationRegistry.unregister('worker-auth-handler');
    this.uiNotificationCallback = undefined;
  }
}

/**
 * Singleton instance for the Shape Plugin
 */
let shapeAuthHandlerInstance: WorkerAuthHandler | null = null;

/**
 * Get or create the Shape Plugin auth handler instance
 */
export function getShapeAuthHandler(): WorkerAuthHandler {
  if (!shapeAuthHandlerInstance) {
    shapeAuthHandlerInstance = new WorkerAuthHandler();
  }
  return shapeAuthHandlerInstance;
}

/**
 * Dispose the Shape Plugin auth handler instance
 */
export function disposeShapeAuthHandler(): void {
  if (shapeAuthHandlerInstance) {
    shapeAuthHandlerInstance.dispose();
    shapeAuthHandlerInstance = null;
  }
}
