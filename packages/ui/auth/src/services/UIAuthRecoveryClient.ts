import { AuthNotificationFactory, AuthNotificationRegistry } from '@hierarchidb/auth';
import type { BFFUser } from './AuthSessionStorage.js';
import { AuthSessionStorage } from './AuthSessionStorage.js';

export type AuthPromptResult = {
  user: BFFUser;
  refreshTokenId?: string;
};

export type AuthPrompt = (n: {
  context: { requestId: string; sessionId?: string };
}) => Promise<AuthPromptResult>;

/**
 * Register UI-side handlers to resolve AuthRequired notifications.
 * The provided prompt callback must return a complete canonical UI session.
 */
export function registerAuthUIHandlers(prompt: AuthPrompt, opts?: { id?: string }) {
  const registry = AuthNotificationRegistry.getInstance();
  const id = opts?.id ?? 'ui-auth-recovery-client';
  registry.register(id, {
    onAuthRequired: async (notification: {
      context: { requestId: string; sessionId?: string };
    }): Promise<void> => {
      const { requestId, sessionId } = notification.context;
      try {
        const res = await prompt(notification);
        AuthSessionStorage.persist(res.user, res.refreshTokenId);
        const success = AuthNotificationFactory.createAuthSuccess({
          requestId,
          newToken: res.user.access_token,
          tokenType: 'Bearer',
          expiresAt: res.user.expires_at,
          sessionId,
          userInfo: {
            id: res.user.id,
            email: res.user.email,
            name: res.user.name,
            ...(res.user.picture === undefined ? {} : { picture: res.user.picture }),
          },
        });
        await registry.dispatch(success);
      } catch {
        const cancelled = AuthNotificationFactory.createAuthCancelled({
          requestId,
          sessionId,
          reason: 'error',
        });
        await registry.dispatch(cancelled);
      }
    },
    onAuthSuccess: async () => {},
    onAuthCancelled: async () => {},
  });
}
