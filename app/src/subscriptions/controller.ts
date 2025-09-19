// Temporary stub for subscriptions controller used by TreeConsoleIntegration
export class Subscriptions {
  static getInstance() { return new Subscriptions(); }
  static getActive(..._args: any[]) { return [{ subId: 'sub-1', created: Date.now() }]; }
  static subscribe(..._args: any[]) { return { subId: 'sub-1', created: true }; }
  static release(..._args: any[]) { /* noop */ }
}
