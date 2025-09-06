declare module '@hierarchidb/common-auth' {
  export interface AuthRequiredNotification { context: any; }
  export interface AuthSuccessNotification { context: any; }
  export type AuthNotification = AuthRequiredNotification | AuthSuccessNotification | any;
  export class AuthNotificationRegistry {
    static getInstance(): AuthNotificationRegistry;
    register(id: string, handlers: { onAuthRequired?: (n: any) => Promise<void> | void; onAuthSuccess?: (n: any) => Promise<void> | void; onAuthCancelled?: (n: any) => Promise<void> | void }): void;
    unregister?(id: string): void;
    dispatch(n: any): Promise<void>;
  }
  export const AuthNotificationFactory: {
    createAuthRequired(input: any): any;
    createAuthSuccess(input: any): any;
  };
}

