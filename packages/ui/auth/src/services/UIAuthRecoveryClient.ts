import { AuthNotificationFactory, AuthNotificationRegistry } from '@hierarchidb/auth';

export type AuthPromptResult = {
  token: string;
  type?: 'Bearer' | 'Basic';
  expiresAt?: number;
};

export type AuthPrompt = (n: {
  context: { requestId: string; sessionId?: string };
}) => Promise<AuthPromptResult>;

/**
 * Register UI-side handlers to resolve AuthRequired notifications.
 * The provided prompt callback should display login/consent UI and return a token.
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
        const success = AuthNotificationFactory.createAuthSuccess({
          requestId,
          newToken: res.token,
          tokenType: res.type ?? 'Bearer',
          expiresAt: res.expiresAt ?? Date.now() + 60 * 60 * 1000,
          sessionId,
        });
        await registry.dispatch(success);
      } catch (_error) {
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
