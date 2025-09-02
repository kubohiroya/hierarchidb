declare module '@hierarchidb/common-auth' {
  export type PluginType = 'shape' | 'spreadsheet' | 'styler' | 'generic';
  export type AuthSource = 'worker' | 'cors-proxy' | 'bff' | 'external-api';
  export const AuthNotificationRegistry: {
    getInstance(): {
      register(id: string, handlers: any): void;
      dispatch(notification: any): Promise<void>;
    };
  };
  export const AuthNotificationFactory: {
    createAuthSuccess(p: any): any;
    createAuthCancelled(p: any): any;
  };
}

