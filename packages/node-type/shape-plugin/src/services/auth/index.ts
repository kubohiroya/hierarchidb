/**
 * Authentication service exports for Shape Plugin
 * Provides singleton instance management for authentication handlers
 */

// Re-export authentication types from common-auth
export type {
  AuthRequiredNotification,
  AuthSource,
  PluginType,
} from '@hierarchidb/common-auth';

// Backwards-compatible named export to retrieve the shared auth recovery service
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';
export async function getShapeAuthHandler(): Promise<AuthRecoveryService> {
  return await AuthRecoveryService.getSingleton();
}
export function resetShapeAuthHandler(): void {
  // no-op; kept for compatibility with old tests
}
