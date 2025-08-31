export interface InvokeResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface PluginAPI {
  invoke(method: string, ...args: any[]): Promise<InvokeResult>;
}

export class PluginAPIRegistry {
  private static apis = new Map<string, PluginAPI>();

  static register(nodeType: string, api: PluginAPI): void {
    this.apis.set(nodeType, api);
  }

  static get(nodeType: string): PluginAPI | undefined {
    return this.apis.get(nodeType);
  }

  static unregister(nodeType: string): void {
    this.apis.delete(nodeType);
  }

  static clear(): void {
    this.apis.clear();
  }
}