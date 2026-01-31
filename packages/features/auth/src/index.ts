export { AuthService } from './AuthService.js';
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
} from '@hierarchidb/auth-api';

export {
  AUTH_CONSTANTS,
  AuthNotificationFactory,
  AuthNotificationGuards,
  AuthNotificationRegistry,
  detectAuthSource,
  generateRequestId,
} from './AuthNotificationSystem.js';
