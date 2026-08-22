import type { BivariantCallback, PluginStepConfig, StepData } from './PluginStepRegistry.js';
import { erasePluginStepConfig } from './PluginStepRegistry.js';

export type HostName = string;

export interface HostProfileContext {
  nodeType: string;
}

export interface HostProfileProvider<TData extends StepData = StepData> {
  name: HostName;
  getBaseStepConfigs: (
    mode: 'create' | 'edit',
    ctx: HostProfileContext
  ) => ReadonlyArray<PluginStepConfig<TData>>;
  // Optional overall submit guard; host may tighten eligibility
  canSubmit?: BivariantCallback<[data: TData], boolean | Promise<boolean>>;
}

export class HostProfileRegistry {
  private static singleton: HostProfileRegistry | null = null;
  private providers = new Map<HostName, HostProfileProvider<StepData>>();
  private listeners: Set<() => void> = new Set();
  private version = 0;

  static getInstance(): HostProfileRegistry {
    if (!HostProfileRegistry.singleton) HostProfileRegistry.singleton = new HostProfileRegistry();
    return HostProfileRegistry.singleton;
  }

  register<TData extends StepData>(provider: HostProfileProvider<TData>): void {
    this.providers.set(provider.name, {
      name: provider.name,
      getBaseStepConfigs: (mode, ctx) =>
        provider.getBaseStepConfigs(mode, ctx).map(erasePluginStepConfig),
      canSubmit: provider.canSubmit
        ? (data) => provider.canSubmit?.(data as TData) ?? false
        : undefined,
    });
    this.emitChange();
  }

  get(name: HostName): HostProfileProvider<StepData> | undefined {
    return this.providers.get(name);
  }

  /**
   * Resolve host name for a given nodeType using global plugin definitions injected by the app.
   * Falls back to undefined when not found.
   */
  resolveHostForNodeType(nodeType: string): HostName | undefined {
    try {
      type PluginDef = { nodeType: string; config?: { extends?: string; base?: string } };
      const globalObj =
        typeof window !== 'undefined'
          ? (window as { __HDB_PLUGIN_DEFS__?: PluginDef[] })
          : (globalThis as { __HDB_PLUGIN_DEFS__?: PluginDef[] });
      const defs: PluginDef[] = Array.isArray(globalObj.__HDB_PLUGIN_DEFS__)
        ? globalObj.__HDB_PLUGIN_DEFS__
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
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Current change counter. */
  getVersion(): number {
    return this.version;
  }

  private emitChange(): void {
    this.version++;
    for (const fn of Array.from(this.listeners)) {
      try {
        fn();
      } catch {
        /* noop */
      }
    }
  }
}
