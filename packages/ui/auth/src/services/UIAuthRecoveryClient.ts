import { AuthNotificationRegistry, AuthNotificationFactory } from '@hierarchidb/common-auth';

export type AuthRequiredPayload = {
  context: {
    requestId: string;
    url: string;
    method: string;
    pluginType?: 'shape' | 'spreadsheet' | 'styler' | 'generic';
    sessionId?: string;
    errorCode?: number;
    errorMessage?: string;
  };
};

export type AuthPromptResult = {
  token: string;
  type?: 'Bearer' | 'Basic';
  expiresAt?: number;
};

export type AuthPrompt = (n: AuthRequiredPayload) => Promise<AuthPromptResult>;

/**
 * Register UI-side handlers to resolve AuthRequired notifications.
 * The provided prompt callback should display login/consent UI and return a token.
 */
export function registerAuthUIHandlers(prompt: AuthPrompt, opts?: { id?: string }) {
  const registry = AuthNotificationRegistry.getInstance();
  const id = opts?.id ?? 'ui-auth-recovery-client';
  registry.register(id, {
    onAuthRequired: async (n: AuthRequiredPayload) => {
      const { requestId, pluginType } = n.context;
      try {
        const res = await prompt(n);
        await registry.dispatch(
          AuthNotificationFactory.createAuthSuccess({
            context: {
              requestId,
              pluginType,
              newToken: res.token,
              tokenType: res.type ?? 'Bearer',
              expiresAt: res.expiresAt,
            },
          })
        );
      } catch (e: any) {
        await registry.dispatch(
          AuthNotificationFactory.createAuthCancelled({
            context: { requestId, pluginType, reason: e?.message || 'cancelled' },
          })
        );
      }
    },
  });
}

