/**
 * Plugin Step Registry
 * Manages plugin-provided dialog steps
 */

import type { DialogStep } from '@hierarchidb/ui-dialog';
import type { ReactNode, RefObject } from 'react';
import { dialogStepLocalizationRegistry } from './DialogStepLocalizationRegistry.js';

// Abstract step payload shape. Concrete plugins should extend this with their own dialog data types.
export type StepData = object;
export type StepUiState = object;

export type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack: (...args: TArgs) => TResult;
}['bivarianceHack'];

type DataCallback<
  TData extends StepData,
  TUiState extends StepUiState,
  TResult,
> = BivariantCallback<[data: TData, uiState?: TUiState], TResult>;

type OptionalDataCallback<TData extends StepData, TResult> = BivariantCallback<
  [data?: TData],
  TResult
>;

type StartBuildCallback<TData extends StepData, TUiState extends StepUiState> = BivariantCallback<
  [data: TData, context: StartBuildContext<TData, TUiState>],
  void | Promise<void>
>;

export type BeforeNavigateNextResult<TData extends StepData = StepData> =
  | {
      readonly type: 'advance';
      readonly nodeId?: string;
      readonly nodeVersion?: number;
      readonly canonicalData?: TData;
    }
  | {
      readonly type: 'stay';
      readonly reason: string;
    };

export interface BeforeNavigateNextContext<
  TData extends StepData = StepData,
  TUiState extends StepUiState = StepUiState,
> {
  readonly nodeId?: string;
  readonly parentId?: string;
  readonly treeId?: string;
  readonly mode: 'create' | 'edit';
  readonly currentStepId: string;
  readonly targetStepId: string;
  readonly currentStepIndex: number;
  readonly targetStepIndex: number;
  readonly currentNodeVersion?: number;
  readonly dialogData: TData;
  readonly draftData: TData;
  readonly uiState?: TUiState;
  readonly signal: AbortSignal;
  readonly setPhase: (phase: string) => void;
  readonly setCancellable: (cancellable: boolean) => void;
}

type BeforeNavigateNextCallback<
  TData extends StepData,
  TUiState extends StepUiState,
> = BivariantCallback<
  [data: TData, context: BeforeNavigateNextContext<TData, TUiState>],
  BeforeNavigateNextResult<TData> | Promise<BeforeNavigateNextResult<TData>>
>;

export interface StepLocalizationConfig {
  defaultTitle?: string;
  titles?: Partial<Record<string, string>>;
  translationKey?: string;
}

/**
 * Plugin step provider interface
 */
export interface PluginStepProvider<TData extends StepData = StepData> {
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
export interface PluginStepConfigProvider<
  TData extends StepData = StepData,
  TUiState extends StepUiState = StepUiState,
> {
  nodeType: string;
  getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<TData, TUiState>>;
  getEditStepConfigs(
    nodeId: string,
    data?: TData
  ): ReadonlyArray<PluginStepConfig<TData, TUiState>>;
  validateAccess?(nodeId?: string): Promise<boolean>;
}

/**
 * Plugin step configuration
 */
export interface StartBuildContext<
  TData extends StepData = StepData,
  TUiState extends StepUiState = StepUiState,
> {
  /**
   * Canonical node id if already persisted. Use this to start worker-side build jobs.
   */
  nodeId?: string;

  /** Parent node id for create-mode dialogs. */
  parentId?: string;

  /** Tree id of the current draft (TreeNodeUpdater). */
  treeId?: string;

  /** Dialog mode. */
  mode: 'create' | 'edit';

  /**
   * Merged dialog data (basic info + draft step data).
   * Useful when the step-level data omits metadata.
   */
  dialogData: TData;

  /**
   * Ephemeral UI atoms (validation, button enables, etc.). Not persisted.
   */
  uiState?: TUiState;
}

export interface PluginStepConfig<
  TData extends StepData = StepData,
  TUiState extends StepUiState = StepUiState,
> {
  /** Step ID */
  id: string;

  /** Step label */
  label: string;

  /** Optional localization metadata */
  localization?: StepLocalizationConfig;

  /** Step component factory */
  componentFactory: BivariantCallback<[props: PluginStepProps<TData, TUiState>], ReactNode>;

  /** Validation function */
  validate?: OptionalDataCallback<TData, boolean | Promise<boolean>>;

  /** Step capabilities */
  capabilities?: {
    canNavigateTo?: BivariantCallback<
      [fromStep: number, data: TData, uiState?: TUiState],
      boolean | Promise<boolean>
    >;
    canStartBuild?: DataCallback<TData, TUiState, boolean | Promise<boolean>>;
    canSave?: DataCallback<TData, TUiState, boolean | Promise<boolean>>;
    canProceedToNext?: DataCallback<TData, TUiState, boolean | Promise<boolean>>;
    canBackToPrevious?: DataCallback<TData, TUiState, boolean | Promise<boolean>>;
    beforeNavigateNext?: BeforeNavigateNextCallback<TData, TUiState>;
    startBuild?: StartBuildCallback<TData, TUiState>;
  };

  /** Whether step is optional */
  optional?: boolean;

  /** Step icon */
  icon?: ReactNode;
}

/**
 * Props passed to step components
 */
export interface PluginStepProps<
  TData extends StepData = StepData,
  TUiState extends StepUiState = StepUiState,
> {
  /** Dialog mode */
  mode: 'create' | 'edit';

  /** Node ID (for edit mode) */
  nodeId?: string;

  /** Parent node ID (for create mode) */
  parentId?: string;

  /** Current data */
  data: TData;

  /** Optional UI atoms shared across steps (not persisted) */
  uiState?: TUiState;

  /** Update data */
  onChange: BivariantCallback<[data: TData], void>;

  /** Update UI atoms */
  onUiStateChange?: BivariantCallback<[uiState: TUiState], void>;

  /** Mark step as valid/invalid */
  setValid: (valid: boolean) => void;

  /** Set step error message */
  setError: (error: string | null) => void;

  disabled: boolean;

  dialogRef?: RefObject<HTMLElement | null>;
}

/** @deprecated Use PluginStepProps instead. */

const registerAndResolveLabel = <TData extends StepData>(
  nodeType: string,
  cfg: PluginStepConfig<TData>
): string => {
  const defaultTitle = cfg.localization?.defaultTitle ?? cfg.label ?? cfg.id;
  dialogStepLocalizationRegistry.register(nodeType, {
    id: cfg.id,
    defaultTitle,
    titles: cfg.localization?.titles,
    translationKey: cfg.localization?.translationKey,
  });
  return dialogStepLocalizationRegistry.resolveTitle(nodeType, cfg.id);
};

export const erasePluginStepConfig = <
  TData extends StepData,
  TUiState extends StepUiState = StepUiState,
>(
  cfg: PluginStepConfig<TData, TUiState>
): PluginStepConfig<StepData, StepUiState> => {
  const validate = cfg.validate;
  const canNavigateTo = cfg.capabilities?.canNavigateTo;
  const canStartBuild = cfg.capabilities?.canStartBuild;
  const canSave = cfg.capabilities?.canSave;
  const canProceedToNext = cfg.capabilities?.canProceedToNext;
  const canBackToPrevious = cfg.capabilities?.canBackToPrevious;
  const beforeNavigateNext = cfg.capabilities?.beforeNavigateNext;
  const startBuild = cfg.capabilities?.startBuild;

  return {
    ...cfg,
    componentFactory: (props) =>
      cfg.componentFactory({
        ...props,
        data: props.data as TData,
        uiState: props.uiState as TUiState | undefined,
        onChange: (data) => props.onChange(data),
        onUiStateChange: props.onUiStateChange
          ? (uiState) => props.onUiStateChange?.(uiState)
          : undefined,
      }),
    validate: validate ? (data) => validate(data as TData | undefined) : undefined,
    capabilities: cfg.capabilities
      ? {
          canNavigateTo: canNavigateTo
            ? (fromStep, data, uiState) =>
                canNavigateTo(fromStep, data as TData, uiState as TUiState | undefined)
            : undefined,
          canStartBuild: canStartBuild
            ? (data, uiState) => canStartBuild(data as TData, uiState as TUiState | undefined)
            : undefined,
          canSave: canSave
            ? (data, uiState) => canSave(data as TData, uiState as TUiState | undefined)
            : undefined,
          canProceedToNext: canProceedToNext
            ? (data, uiState) => canProceedToNext(data as TData, uiState as TUiState | undefined)
            : undefined,
          canBackToPrevious: canBackToPrevious
            ? (data, uiState) => canBackToPrevious(data as TData, uiState as TUiState | undefined)
            : undefined,
          beforeNavigateNext: beforeNavigateNext
            ? (data, context) =>
                beforeNavigateNext(data as TData, {
                  ...context,
                  dialogData: context.dialogData as TData,
                  draftData: context.draftData as TData,
                  uiState: context.uiState as TUiState | undefined,
                })
            : undefined,
          startBuild: startBuild
            ? (data, context) =>
                startBuild(data as TData, {
                  ...context,
                  dialogData: context.dialogData as TData,
                  uiState: context.uiState as TUiState | undefined,
                })
            : undefined,
        }
      : undefined,
  };
};

/**
 * Plugin Step Registry
 */
export class PluginStepRegistry {
  private static instance: PluginStepRegistry;
  private providers: Map<string, PluginStepProvider<StepData>> = new Map();
  private configProviders: Map<string, PluginStepConfigProvider<StepData, StepUiState>> = new Map();
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
  register<TData extends StepData>(provider: PluginStepProvider<TData>): void {
    if (this.providers.has(provider.nodeType)) {
      return;
    }
    this.providers.set(provider.nodeType, provider as PluginStepProvider<StepData>);
    this.emitChange();
  }

  /** Register a config-based provider (typed componentFactory) */
  registerConfigProvider<TData extends StepData, TUiState extends StepUiState = StepUiState>(
    provider: PluginStepConfigProvider<TData, TUiState>
  ): void {
    if (this.configProviders.has(provider.nodeType)) {
      return;
    }
    this.configProviders.set(provider.nodeType, {
      nodeType: provider.nodeType,
      getCreateStepConfigs: () => provider.getCreateStepConfigs().map(erasePluginStepConfig),
      getEditStepConfigs: (nodeId, data) =>
        provider.getEditStepConfigs(nodeId, data as TData | undefined).map(erasePluginStepConfig),
      validateAccess: provider.validateAccess?.bind(provider),
    });
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
  getProvider(nodeType: string): PluginStepProvider<StepData> | undefined {
    return this.providers.get(nodeType);
  }

  getConfigProvider(nodeType: string): PluginStepConfigProvider<StepData, StepUiState> | undefined {
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
  getEditSteps(nodeType: string, nodeId: string, data?: StepData): DialogStep[] {
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
