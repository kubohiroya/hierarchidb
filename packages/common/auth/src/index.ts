/**
 * @file index.ts
 * @description Export all authentication system components
 */

export * from './AuthNotificationSystem.js';

// Re-export commonly used types
export type {
  AuthNotification,
  AuthRequiredNotification,
  AuthSuccessNotification,
  AuthCancelledNotification,
  AuthNotificationHandler,
  AuthSource,
  PluginType,
  AuthNotificationType,
} from './AuthNotificationSystem.js';

// Re-export main classes and utilities
export {
  AuthNotificationRegistry,
  AuthNotificationFactory,
  AuthNotificationGuards,
  AUTH_CONSTANTS,
  generateRequestId,
  detectAuthSource,
} from './AuthNotificationSystem.js';