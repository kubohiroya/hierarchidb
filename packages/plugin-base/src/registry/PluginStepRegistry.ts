/**
 * Plugin Step Registry
 * Manages plugin-provided dialog steps
 */

import type { DialogStep } from '@hierarchidb/ui-dialog';
import type { ReactNode } from 'react';
import { dialogStepLocalizationRegistry } from './DialogStepLocalizationRegistry.js';

export interface StepLocalizationConfig {
  defaultTitle?: string;
  titles?: Partial<Record<string, string>>;
  translationKey?: string;
}

/**
 * Plugin step provider interface
 */
export interface PluginStepProvider<TData = unknown> {
  /** Node type this provider handles */
  nodeType: string;

  /** Get steps for create mode */
  getCreateSteps(): DialogStep[];

  /** Get steps for edit mode */
  getEditSteps(nodeId: string, data?: TData): DialogStep[];

  /** Optional validation before showing dialog */
  validateAccess?(nodeId?: string): Promise<boolean>;
}

/**
 * New: Config-based provider that supplies typed component factories.
 */
export interface PluginStepConfigProvider<TData = unknown> {
  nodeType: string;
  getCreateStepConfigs(): PluginStepConfig<TData>[];
  getEditStepConfigs(nodeId: string, data?: TData): PluginStepConfig<TData>[];
  validateAccess?(nodeId?: string): Promise<boolean>;
}

/**
 * Plugin step configuration
 */
export interface PluginStepConfig<TData = unknown> {
  /** Step ID */
  id: string;

  /** Step label */
  label: string;

  /** Optional localization metadata */
  localization?: StepLocalizationConfig;

  /** Step component factory */
  componentFactory: (props: StepComponentProps<TData>) => ReactNode;

  /** Validation function */
  validate?: (data?: TData) => boolean | Promise<boolean>;

  /** Step capabilities */
  capabilities?: {
    canNavigateTo?: (fromStep: number, data: TData) => boolean | Promise<boolean>;
    canStartBatch?: (data: TData) => boolean | Promise<boolean>;
    canSave?: (data: TData) => boolean | Promise<boolean>;
    canProceedToNext?: (data: TData) => boolean | Promise<boolean>;
    canBackToPrevious?: (data: TData) => boolean | Promise<boolean>;
  };

  /** Whether step is optional */
  optional?: boolean;

  /** Step icon */
  icon?: ReactNode;
}

/**
 * Props passed to step components
 */
export interface StepComponentProps<TData = unknown> {
  /** Dialog mode */
  mode: 'create' | 'edit';

  /** Node ID (for edit mode) */
  nodeId?: string;

  /** Parent node ID (for create mode) */
  parentId?: string;

  /** Current data */
  data: TData;

  /** Update data */
  onChange: (data: TData) => void;

  /** Mark step as valid/invalid */
  setValid: (valid: boolean) => void;

  /** Set step error message */
  setError: (error: string | null) => void;

  disabled: boolean;
}

const registerAndResolveLabel = (nodeType: string, cfg: PluginStepConfig): string => {
  const defaultTitle = cfg.localization?.defaultTitle ?? cfg.label ?? cfg.id;
  dialogStepLocalizationRegistry.register(nodeType, {
    id: cfg.id,
    defaultTitle,
    titles: cfg.localization?.titles,
    translationKey: cfg.localization?.translationKey,
  });
  return dialogStepLocalizationRegistry.resolveTitle(nodeType, cfg.id);
};

/**
 * Plugin Step Registry
 */
export class PluginStepRegistry {
  private static instance: PluginStepRegistry;
  private providers: Map<string, PluginStepProvider<unknown>> = new Map();
  private configProviders: Map<string, PluginStepConfigProvider<unknown>> = new Map();
  private listeners: Set<() => void> = new Set();
  private version = 0;

  private constructor() {
    /* noop */
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PluginStepRegistry {
    if (!PluginStepRegistry.instance) {
      PluginStepRegistry.instance = new PluginStepRegistry();
    }
    return PluginStepRegistry.instance;
  }

  /**
   * Register a step provider
   */
  register<TData>(provider: PluginStepProvider<TData>): void {
    if (this.providers.has(provider.nodeType)) {
      return;
    }
    this.providers.set(provider.nodeType, provider as PluginStepProvider<unknown>);
    this.emitChange();
  }

  /** Register a config-based provider (typed componentFactory) */
  registerConfigProvider<TData>(provider: PluginStepConfigProvider<TData>): void {
    if (this.configProviders.has(provider.nodeType)) {
      return;
    }
    this.configProviders.set(provider.nodeType, provider as PluginStepConfigProvider<unknown>);
    this.emitChange();
  }

  /**
   * Unregister a step provider
   */
  unregister(nodeType: string): void {
    this.providers.delete(nodeType);
    this.configProviders.delete(nodeType);
    this.emitChange();
  }

  /**
   * Get provider for node type
   */
  getProvider(nodeType: string): PluginStepProvider<unknown> | undefined {
    return this.providers.get(nodeType);
  }

  getConfigProvider(nodeType: string): PluginStepConfigProvider<unknown> | undefined {
    return this.configProviders.get(nodeType);
  }

  /**
   * Get all registered node types
   */
  getRegisteredNodeTypes(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get create steps for node type
   */
  getCreateSteps(nodeType: string): DialogStep[] {
    const cfgp = this.configProviders.get(nodeType);
    if (cfgp) {
      // Bridge to DialogStep: host側で componentFactory をラップして描画する
      const cfgs = cfgp.getCreateStepConfigs();
      return cfgs.map(
        (c) =>
          ({
            id: c.id,
            label: registerAndResolveLabel(nodeType, c),
            component: null,
            validate: c.validate,
            optional: c.optional,
          }) as DialogStep
      );
    }
    const provider = this.providers.get(nodeType);
    return provider ? provider.getCreateSteps() : [];
  }

  /**
   * Get edit steps for node type
   */
  getEditSteps(nodeType: string, nodeId: string, data?: unknown): DialogStep[] {
    const cfgp = this.configProviders.get(nodeType);
    if (cfgp) {
      const cfgs = cfgp.getEditStepConfigs(nodeId, data);
      return cfgs.map(
        (c) =>
          ({
            id: c.id,
            label: registerAndResolveLabel(nodeType, c),
            component: null,
            validate: c.validate,
            optional: c.optional,
          }) as DialogStep
      );
    }
    const provider = this.providers.get(nodeType);
    return provider ? provider.getEditSteps(nodeId, data) : [];
  }

  /**
   * Validate access to node
   */
  async validateAccess(nodeType: string, nodeId?: string): Promise<boolean> {
    const cfgp = this.configProviders.get(nodeType);
    if (cfgp?.validateAccess) return cfgp.validateAccess(nodeId);
    const provider = this.providers.get(nodeType);
    if (provider?.validateAccess) return provider.validateAccess(nodeId);
    return true;
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear();
    this.configProviders.clear();
    this.emitChange();
  }

  /** Subscribe to registry changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Current change counter for convenient dependencies. */
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
