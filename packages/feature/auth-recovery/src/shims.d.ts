declare module '@hierarchidb/util' {
  export class SingletonMixin {
    static getSingleton<T>(k: string, f: () => T | Promise<T>): Promise<T>;
  }
}
declare module '@hierarchidb/common-auth' {
  export type AuthSource = 'worker' | 'cors-proxy' | 'bff' | 'external-api';
  export type PluginType = 'shape' | 'spreadsheet' | 'styler' | 'generic';
  export const AUTH_CONSTANTS: { DEFAULT_TIMEOUT: number; MAX_RETRY_COUNT: number };
  export const AuthNotificationRegistry: { getInstance(): any };
  export const AuthNotificationFactory: { createAuthRequired(p: any): any };
  export const AuthNotificationGuards: any;

  export function detectAuthSource(r: Response): AuthSource;
}
