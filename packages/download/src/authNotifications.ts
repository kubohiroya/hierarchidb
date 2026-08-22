export type AuthNotification = {
  resource: string;
  provider?: string;
  hint?: string;
  status?: number;
};

const authNotifiers = new Map<string, (info: AuthNotification) => void>();

export function registerPluginAuthNotifier(
  pluginId: string,
  fn: (info: AuthNotification) => void
): void {
  authNotifiers.set(pluginId, fn);
}

export function notifyPluginAuthRequired(pluginId: string, info: AuthNotification): void {
  const handler = authNotifiers.get(pluginId);
  if (handler) {
    handler(info);
    return;
  }
  const globalScope = globalThis as {
    AuthNotificationRegistry?: {
      getInstance?: () => { onAuthRequired?: (payload: AuthNotification) => void };
    };
    authNotificationRegistry?: { onAuthRequired?: (payload: AuthNotification) => void };
    authRegistry?: { onAuthRequired?: (payload: AuthNotification) => void };
  };
  const registry =
    globalScope.AuthNotificationRegistry?.getInstance?.() ??
    globalScope.authNotificationRegistry ??
    globalScope.authRegistry;
  registry?.onAuthRequired?.(info);
}
