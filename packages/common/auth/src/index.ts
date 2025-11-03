/**
 * @file RuntimeWorkerService.ts
 * @description Export all authentication system components
 */

// Re-export commonly used types
export type {
  AuthCancelledNotification,
  AuthNotification,
  AuthNotificationHandler,
  AuthNotificationType,
  AuthRequiredNotification,
  AuthSource,
  AuthSuccessNotification,
  PluginType,
} from './AuthNotificationSystem.js';
export * from './AuthNotificationSystem.js';

// Re-export main classes and utilities
export {
  AUTH_CONSTANTS,
  AuthNotificationFactory,
  AuthNotificationGuards,
  AuthNotificationRegistry,
  detectAuthSource,
  generateRequestId,
} from './AuthNotificationSystem.js';
