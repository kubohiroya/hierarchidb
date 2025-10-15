import type { PluginStepConfig } from './PluginStepRegistry.js';

export type HostName = string;

export interface HostProfileContext {
  nodeType: string;
}

export interface HostProfileProvider<TData = unknown> {
  name: HostName;
  getBaseStepConfigs: (mode: 'create' | 'edit', ctx: HostProfileContext) => PluginStepConfig[];
  // Optional overall submit guard; host may tighten eligibility
  canSubmit?: (data: TData) => boolean | Promise<boolean>;
}

export class HostProfileRegistry {
  private static singleton: HostProfileRegistry | null = null;
  private providers = new Map<HostName, HostProfileProvider<any>>();
  private listeners: Set<() => void> = new Set();
  private version = 0;

  static getInstance(): HostProfileRegistry {
    if (!HostProfileRegistry.singleton) HostProfileRegistry.singleton = new HostProfileRegistry();
    return HostProfileRegistry.singleton;
  }

  register<TData>(provider: HostProfileProvider<TData>): void {
    this.providers.set(provider.name, provider as HostProfileProvider<any>);
    this.emitChange();
  }

  get(name: HostName): HostProfileProvider<any> | undefined {
    return this.providers.get(name);
  }

  /**
   * Resolve host name for a given nodeType using global plugin definitions injected by the app.
   * Falls back to undefined when not found.
   */
  resolveHostForNodeType(nodeType: string): HostName | undefined {
    try {
      type PluginDef = { nodeType: string; config?: { extends?: string; base?: string } };
      const g = (typeof window !== 'undefined' ? window : ({} as unknown)) as { __HDB_PLUGIN_DEFS__?: PluginDef[] };
      const defs: PluginDef[] = Array.isArray(g.__HDB_PLUGIN_DEFS__)
        ? (g.__HDB_PLUGIN_DEFS__ as PluginDef[])
        : [];
      const def = defs.find((d) => d.nodeType === nodeType);
      const ext = def?.config?.extends || def?.config?.base || undefined;
      return typeof ext === 'string' ? (ext as HostName) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Current change counter. */
  getVersion(): number { return this.version; }

  private emitChange(): void {
    this.version++;
    for (const fn of Array.from(this.listeners)) {
      try { fn(); } catch { /* noop */ }
    }
  }
}
