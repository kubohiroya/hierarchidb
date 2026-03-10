export { AuthService, AuthRequiredError } from './AuthService.js';
export { AuthRecoveryService } from './AuthRecoveryService.js';

export type {
  AuthCancelledNotification,
  AuthNotification,
  AuthNotificationHandler,
  AuthNotificationType,
  AuthRequiredNotification,
  AuthSource,
  AuthSuccessNotification,
  PluginType,
  StorageWarningNotification,
} from '@hierarchidb/auth-api';

export {
  AUTH_CONSTANTS,
  AuthNotificationFactory,
  AuthNotificationGuards,
  AuthNotificationRegistry,
  detectAuthSource,
  generateRequestId,
} from './AuthNotificationSystem.js';
