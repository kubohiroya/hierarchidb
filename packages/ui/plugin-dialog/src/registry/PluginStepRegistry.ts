/**
 * Plugin Step Registry
 * Manages plugin-provided dialog steps
 */

import { ReactNode } from 'react';
import { DialogStep } from '@hierarchidb/ui-dialog';
import { dialogStepLocalizationRegistry } from './DialogStepLocalizationRegistry.js';

export interface StepLocalizationConfig {
  defaultTitle?: string;
  titles?: Partial<Record<string, string>>;
  translationKey?: string;
}

/**
 * Plugin step provider interface
 */
export interface PluginStepProvider {
  /** Node type this provider handles */
  nodeType: string;

  /** Get steps for create mode */
  getCreateSteps(): DialogStep[];

  /** Get steps for edit mode */
  getEditSteps(nodeId: string, data?: any): DialogStep[];

  /** Optional validation before showing dialog */
  validateAccess?(nodeId?: string): Promise<boolean>;
}

/**
 * New: Config-based provider that supplies typed component factories.
 */
export interface PluginStepConfigProvider {
  nodeType: string;
  getCreateStepConfigs(): PluginStepConfig[];
  getEditStepConfigs(nodeId: string, data?: any): PluginStepConfig[];
  validateAccess?(nodeId?: string): Promise<boolean>;
}

/**
 * Plugin step configuration
 */
export interface PluginStepConfig {
  /** Step ID */
  id: string;

  /** Step label */
  label: string;

  /** Optional localization metadata */
  localization?: StepLocalizationConfig;

  /** Step component factory */
  componentFactory: (props: StepComponentProps) => ReactNode;

  /** Validation function */
  validate?: (data?: any) => boolean | Promise<boolean>;

  /** Step capabilities */
  capabilities?: {
    canNavigateTo?: (fromStep: number, data: any) => boolean | Promise<boolean>;
    canStartBatch?: (data: any) => boolean | Promise<boolean>;
    canSave?: (data: any) => boolean | Promise<boolean>;
    canProceedToNext?: (data: any) => boolean | Promise<boolean>;
    canBackToPrevious?: (data: any) => boolean | Promise<boolean>;
  };

  /** Whether step is optional */
  optional?: boolean;

  /** Step icon */
  icon?: ReactNode;
}

/**
 * Props passed to step components
 */
export interface StepComponentProps {
  /** Dialog mode */
  mode: 'create' | 'edit';

  /** Node ID (for edit mode) */
  nodeId?: string;

  /** Parent node ID (for create mode) */
  parentId?: string;

  /** Current data */
  data: any;

  /** Update data */
  onChange: (data: any) => void;

  /** Mark step as valid/invalid */
  setValid: (valid: boolean) => void;

  /** Set step error message */
  setError: (error: string | null) => void;
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
  private providers: Map<string, PluginStepProvider> = new Map();
  private configProviders: Map<string, PluginStepConfigProvider> = new Map();
  private listeners: Set<() => void> = new Set();
  private version = 0;

  private constructor() { /* noop */ }

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
  register(provider: PluginStepProvider): void {
    if (this.providers.has(provider.nodeType)) {
      return;
    }
    this.providers.set(provider.nodeType, provider);
    this.emitChange();
  }

  /** Register a config-based provider (typed componentFactory) */
  registerConfigProvider(provider: PluginStepConfigProvider): void {
    if (this.configProviders.has(provider.nodeType)) {
      return;
    }
    this.configProviders.set(provider.nodeType, provider);
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
  getProvider(nodeType: string): PluginStepProvider | undefined {
    return this.providers.get(nodeType);
  }

  getConfigProvider(nodeType: string): PluginStepConfigProvider | undefined {
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
      return cfgs.map((c) => ({
        id: c.id,
        label: registerAndResolveLabel(nodeType, c),
        component: null,
        validate: c.validate,
        optional: c.optional,
      } as DialogStep));
    }
    const provider = this.providers.get(nodeType);
    return provider ? provider.getCreateSteps() : [];
  }

  /**
   * Get edit steps for node type
   */
  getEditSteps(nodeType: string, nodeId: string, data?: any): DialogStep[] {
    const cfgp = this.configProviders.get(nodeType);
    if (cfgp) {
      const cfgs = cfgp.getEditStepConfigs(nodeId, data);
      return cfgs.map((c) => ({
        id: c.id,
        label: registerAndResolveLabel(nodeType, c),
        component: null,
        validate: c.validate,
        optional: c.optional,
      } as DialogStep));
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
    return () => { this.listeners.delete(listener); };
  }

  /** Current change counter for convenient dependencies. */
  getVersion(): number { return this.version; }

  private emitChange(): void {
    this.version++;
    for (const fn of Array.from(this.listeners)) {
      try { fn(); } catch { /* noop */ }
    }
  }
}
