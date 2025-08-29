/**
 * Authentication service exports for Shape Plugin
 * Provides singleton instance management for authentication handlers
 */

import { WorkerAuthHandler } from './WorkerAuthHandler';

// Singleton instance for Shape plugin authentication
let shapeAuthHandlerInstance: WorkerAuthHandler | null = null;

/**
 * Get the singleton instance of WorkerAuthHandler for Shape plugin
 * Creates a new instance if one doesn't exist
 */
export function getShapeAuthHandler(): WorkerAuthHandler {
  if (!shapeAuthHandlerInstance) {
    shapeAuthHandlerInstance = new WorkerAuthHandler();
  }
  return shapeAuthHandlerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetShapeAuthHandler(): void {
  shapeAuthHandlerInstance = null;
}

// Re-export the main class for direct usage
export { WorkerAuthHandler } from './WorkerAuthHandler';

// Re-export authentication types from common-auth
export type {
  AuthRequiredNotification,
  AuthNotificationCallback,
  AuthSource,
  PluginType,
  AuthContext,
} from '@hierarchidb/common-auth';