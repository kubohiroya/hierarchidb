/**
  * Plugin Registry Implementation
  * TreeTable
   */

import type {
  HookExecutionMode,
  PluginLifecycleState,
  PluginPriority,
  PluginRegistry as IPluginRegistry,
  TreeTableHooks,
  TreeTablePlugin,
} from './types.js';
import { HookExecutionError, PluginError, PluginRegistrationError } from './types.js';

/**
    */
interface PluginRuntimeInfo {
  plugin: TreeTablePlugin;
  state: PluginLifecycleState;
  priority: PluginPriority;
  registeredAt: number;
  lastExecuted?: number;
  executionCount: number;
  errors: Error[];
}

/**
    */
interface HookExecutionConfig {
  mode: HookExecutionMode;
  timeout?: number;
  retryCount?: number;
  continueOnError?: boolean;
}

/**
  * TreeTable
  */
export class PluginRegistry implements IPluginRegistry {
  private plugins: Map<string, PluginRuntimeInfo> = new Map();
  private hookConfigs: Map<keyof TreeTableHooks, HookExecutionConfig> = new Map();
  private eventListeners: Map<string, Set<(event: unknown) => void>> = new Map();
  private debugMode: boolean = false;

  constructor(options?: {
    debugMode?: boolean;
    defaultHookConfig?: Partial<HookExecutionConfig>;
  }) {
    this.debugMode = options?.debugMode ?? false;

    const defaultConfig: HookExecutionConfig = {
      mode: 'sequential',
      timeout: 5000,
      retryCount: 0,
      continueOnError: true,
      ...options?.defaultHookConfig,
    };

    this.setHookConfig('onBeforeCellRender', { ...defaultConfig, mode: 'sequential' });
    this.setHookConfig('onAfterCellRender', { ...defaultConfig, mode: 'sequential' });
    this.setHookConfig('onRowClick', { ...defaultConfig, mode: 'first-match' });
    this.setHookConfig('onRowDoubleClick', { ...defaultConfig, mode: 'first-match' });
    this.setHookConfig('onKeyDown', { ...defaultConfig, mode: 'first-match' });
    this.setHookConfig('onBeforeNodeUpdate', { ...defaultConfig, mode: 'sequential' });
    this.setHookConfig('onAfterNodeUpdate', { ...defaultConfig, mode: 'parallel' });
  }

  /**
            */
  register(plugin: TreeTablePlugin): void {
    try {
      this.validatePlugin(plugin);

      if (this.plugins.has(plugin.name)) {
        throw new PluginRegistrationError(
          plugin.name,
          'Plugin with this name is already registered',
        );
      }

      this.validateDependencies(plugin);

      const runtimeInfo: PluginRuntimeInfo = {
        plugin,
        state: 'registered',
        priority: 'normal',
        registeredAt: Date.now(),
        executionCount: 0,
        errors: [],
      };

      this.plugins.set(plugin.name, runtimeInfo);

      this.initializePlugin(plugin.name);

      this.debug(`Plugin registered: ${plugin.name} v${plugin.version}`);
      this.emit('plugin:registered', { plugin: plugin.name });

    } catch (error) {
      this.debug(`Failed to register plugin ${plugin.name}:`, error);
      throw error;
    }
  }

  /**
            */
  unregister(pluginName: string): void {
    const runtimeInfo = this.plugins.get(pluginName);
    if (!runtimeInfo) {
      this.debug(`Plugin not found for unregistration: ${pluginName}`);
      return;
    }

    try {
      this.destroyPlugin(pluginName);

      this.plugins.delete(pluginName);

      this.debug(`Plugin unregistered: ${pluginName}`);
      this.emit('plugin:unregistered', { plugin: pluginName });

    } catch (error) {
      this.debug(`Error during plugin unregistration ${pluginName}:`, error);
      throw new PluginError(`Failed to unregister plugin: ${error}`, pluginName);
    }
  }

  /**
            */
  getPlugin(name: string): TreeTablePlugin | undefined {
    return this.plugins.get(name)?.plugin;
  }

  /**
            */
  getPlugins(): TreeTablePlugin[] {
    return Array.from(this.plugins.values())
      .filter(info => info.state === 'initialized')
      .sort((a, b) => this.comparePriority(a.priority, b.priority))
      .map(info => info.plugin);
  }

  /**
            */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name) &&
      this.plugins.get(name)?.state === 'initialized';
  }

  /**
            */
  executeHook<T extends keyof TreeTableHooks>(
    hookName: T,
    ...args: Parameters<NonNullable<TreeTableHooks[T]>>
  ): Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>> {
    const config = this.hookConfigs.get(hookName) ?? this.getDefaultHookConfig();
    const availablePlugins = this.getAvailablePluginsForHook(hookName);

    if (availablePlugins.length === 0) {
      return [];
    }

    this.debug(`Executing hook: ${String(hookName)} with ${availablePlugins.length} plugins`);

    const startTime = performance.now();
    let results: Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>> = [];

    try {
      switch (config.mode) {
        case 'sequential':
          results = this.executeHookSequential(hookName, availablePlugins, args, config);
          break;
        case 'parallel':
          results = this.executeHookParallel(hookName, availablePlugins, args, config);
          break;
        case 'first-match':
          results = this.executeHookFirstMatch(hookName, availablePlugins, args, config);
          break;
        case 'accumulate':
          results = this.executeHookAccumulate(hookName, availablePlugins, args, config);
          break;
      }
    } catch (error) {
      this.debug(`Hook execution failed: ${String(hookName)}`, error);
      if (!config.continueOnError) {
        throw error;
      }
    }

    const executionTime = performance.now() - startTime;
    this.debug(`Hook ${String(hookName)} completed in ${executionTime.toFixed(2)}ms`);

    this.emit('hook:executed', {
      hookName,
      pluginCount: availablePlugins.length,
      executionTime,
      results,
    });

    return results;
  }

  /**
            */
  setHookConfig(hookName: keyof TreeTableHooks, config: Partial<HookExecutionConfig>): void {
    const currentConfig = this.hookConfigs.get(hookName) || this.getDefaultHookConfig();
    this.hookConfigs.set(hookName, { ...currentConfig, ...config });
  }

  /**
            */
  getPluginState(pluginName: string): PluginLifecycleState | undefined {
    return this.plugins.get(pluginName)?.state;
  }

  /**
            */
  getPluginStats(pluginName: string) {
    const info = this.plugins.get(pluginName);
    if (!info) return undefined;

    return {
      name: info.plugin.name,
      version: info.plugin.version,
      state: info.state,
      priority: info.priority,
      registeredAt: info.registeredAt,
      lastExecuted: info.lastExecuted,
      executionCount: info.executionCount,
      errorCount: info.errors.length,
      recentErrors: info.errors.slice(-5),
    };
  }

  /**
            */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
            */
  on(event: string, listener: (event: unknown) => void): void {
    let listeners = this.eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(event, listeners);
    }
    listeners.add(listener);
  }

  /**
            */
  off(event: string, listener: (event: unknown) => void): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private validatePlugin(plugin: TreeTablePlugin): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new PluginRegistrationError('unknown', 'Plugin name is required and must be a string');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new PluginRegistrationError(plugin.name, 'Plugin version is required and must be a string');
    }

    if (!plugin.hooks || typeof plugin.hooks !== 'object') {
      throw new PluginRegistrationError(plugin.name, 'Plugin hooks must be an object');
    }
  }

  private validateDependencies(plugin: TreeTablePlugin): void {
    if (!plugin.dependencies) return;

    for (const dependency of plugin.dependencies) {
      if (!this.hasPlugin(dependency)) {
        throw new PluginRegistrationError(
          plugin.name,
          `Missing dependency: ${dependency}`,
        );
      }
    }
  }

  private async initializePlugin(pluginName: string): Promise<void> {
    const runtimeInfo = this.plugins.get(pluginName);
    if (!runtimeInfo) return;

    try {
      runtimeInfo.state = 'initializing';

      if (runtimeInfo.plugin.hooks.onPluginInit) {
        await runtimeInfo.plugin.hooks.onPluginInit();
      }

      runtimeInfo.state = 'initialized';
      this.debug(`Plugin initialized: ${pluginName}`);

    } catch (error) {
      runtimeInfo.state = 'error';
      runtimeInfo.errors.push(error as Error);
      throw new PluginError(`Failed to initialize plugin: ${error}`, pluginName);
    }
  }

  private async destroyPlugin(pluginName: string): Promise<void> {
    const runtimeInfo = this.plugins.get(pluginName);
    if (!runtimeInfo) return;

    try {
      if (runtimeInfo.plugin.hooks.onPluginDestroy) {
        await runtimeInfo.plugin.hooks.onPluginDestroy();
      }

      runtimeInfo.state = 'destroyed';
      this.debug(`Plugin destroyed: ${pluginName}`);

    } catch (error) {
      this.debug(`Error destroying plugin ${pluginName}:`, error);
      runtimeInfo.errors.push(error as Error);
    }
  }

  private getAvailablePluginsForHook(hookName: keyof TreeTableHooks): PluginRuntimeInfo[] {
    return Array.from(this.plugins.values())
      .filter(info =>
        info.state === 'initialized' &&
        info.plugin.hooks[hookName],
      )
      .sort((a, b) => this.comparePriority(a.priority, b.priority));
  }

  private executeHookSequential<T extends keyof TreeTableHooks>(
    hookName: T,
    plugins: PluginRuntimeInfo[],
    args: Parameters<NonNullable<TreeTableHooks[T]>>,
    config: HookExecutionConfig,
  ): Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>> {
    const results: Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>> = [];

    for (const pluginInfo of plugins) {
      try {
        const result = this.executePluginHook(pluginInfo, hookName, args);
        results.push(result);

        if (hookName === 'onBeforeCellRender' && result != null) {
          (args as unknown as unknown[])[0] = result;
        } else if (hookName === 'onAfterCellRender' && result != null) {
          (args as unknown as unknown[])[0] = result;
        }

      } catch (error) {
        this.handlePluginError(pluginInfo, hookName, error as Error);
        if (!config.continueOnError) {
          throw error;
        }
      }
    }

    return results;
  }

  private executeHookParallel<T extends keyof TreeTableHooks>(
    hookName: T,
    plugins: PluginRuntimeInfo[],
    args: Parameters<NonNullable<TreeTableHooks[T]>>,
    config: HookExecutionConfig,
  ): Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>> {
    // Note: historical behavior executes synchronously; keep it to avoid behavior changes.
    return plugins.map((pluginInfo) => {
      try {
        return this.executePluginHook(pluginInfo, hookName, args);
      } catch (error) {
        this.handlePluginError(pluginInfo, hookName, error as Error);
        if (config.continueOnError) {
          return undefined as Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>;
        }
        throw error;
      }
    });
  }

  private executeHookFirstMatch<T extends keyof TreeTableHooks>(
    hookName: T,
    plugins: PluginRuntimeInfo[],
    args: Parameters<NonNullable<TreeTableHooks[T]>>,
    config: HookExecutionConfig,
  ): Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>> {
    for (const pluginInfo of plugins) {
      try {
        const result = this.executePluginHook(pluginInfo, hookName, args);
        if (result !== undefined && result !== (false as unknown)) {
          return [result];
        }
      } catch (error) {
        this.handlePluginError(pluginInfo, hookName, error as Error);
        if (!config.continueOnError) {
          throw error;
        }
      }
    }

    return [];
  }

  private executeHookAccumulate<T extends keyof TreeTableHooks>(
    hookName: T,
    plugins: PluginRuntimeInfo[],
    args: Parameters<NonNullable<TreeTableHooks[T]>>,
    config: HookExecutionConfig,
  ): Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>> {
    const results: Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>> = [];

    for (const pluginInfo of plugins) {
      try {
        const result = this.executePluginHook(pluginInfo, hookName, args);
        if (result !== undefined) {
          if (Array.isArray(result)) {
            results.push(...(result as Array<Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>>));
          } else {
            results.push(result);
          }
        }
      } catch (error) {
        this.handlePluginError(pluginInfo, hookName, error as Error);
        if (!config.continueOnError) {
          throw error;
        }
      }
    }

    return results;
  }

  private executePluginHook<T extends keyof TreeTableHooks>(
    pluginInfo: PluginRuntimeInfo,
    hookName: T,
    args: Parameters<NonNullable<TreeTableHooks[T]>>,
  ): Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>> {
    const hook = pluginInfo.plugin.hooks[hookName];
    if (!hook) return undefined as Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>;

    try {
      pluginInfo.executionCount++;
      pluginInfo.lastExecuted = Date.now();

      const hookFunction = hook as (...params: Parameters<NonNullable<TreeTableHooks[T]>>) => ReturnType<NonNullable<TreeTableHooks[T]>>;
      const result = hookFunction(...args);

      this.debug(`Hook ${String(hookName)} executed successfully in plugin ${pluginInfo.plugin.name}`);
      return result as Awaited<ReturnType<NonNullable<TreeTableHooks[T]>>>;

    } catch (error) {
      throw new HookExecutionError(
        pluginInfo.plugin.name,
        hookName,
        error as Error,
      );
    }
  }

  private handlePluginError(
    pluginInfo: PluginRuntimeInfo,
    hookName: keyof TreeTableHooks,
    error: Error,
  ): void {
    pluginInfo.errors.push(error);

    if (pluginInfo.errors.length > 10) {
      pluginInfo.state = 'error';
      this.debug(`Plugin ${pluginInfo.plugin.name} disabled due to excessive errors`);
    }

    this.debug(`Plugin error in ${pluginInfo.plugin.name}.${hookName}:`, error);
    this.emit('plugin:error', {
      plugin: pluginInfo.plugin.name,
      hookName,
      error,
    });
  }

  private comparePriority(a: PluginPriority, b: PluginPriority): number {
    const order = { high: 0, normal: 1, low: 2 };
    return order[a] - order[b];
  }

  private getDefaultHookConfig(): HookExecutionConfig {
    return {
      mode: 'sequential',
      timeout: 5000,
      retryCount: 0,
      continueOnError: true,
    };
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          this.debug(`Event listener error for ${event}:`, error);
        }
      }
    }
  }

  private debug(message: string, ...args: unknown[]): void {
    if (this.debugMode) {
      console.debug(`[PluginRegistry] ${message}`, ...args);
    }
  }
}
