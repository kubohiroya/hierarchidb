/**
 * Plugin Registry Implementation
 * 
 * TreeTableプラグインの登録・管理・実行を行うレジストリクラス。
 * プラグインのライフサイクル管理とフック実行の調整を担当します。
 */

import type {
  TreeTablePlugin,
  TreeTableHooks,
  PluginRegistry as IPluginRegistry,
  PluginLifecycleState,
  HookExecutionMode,
  PluginPriority,
} from './types';
import {
  PluginError,
  PluginRegistrationError,
  HookExecutionError,
} from './types';

/**
 * プラグインの実行時情報
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
 * フック実行の設定
 */
interface HookExecutionConfig {
  mode: HookExecutionMode;
  timeout?: number;
  retryCount?: number;
  continueOnError?: boolean;
}

/**
 * TreeTableプラグインレジストリの実装
 */
export class PluginRegistry implements IPluginRegistry {
  private plugins: Map<string, PluginRuntimeInfo> = new Map();
  private hookConfigs: Map<keyof TreeTableHooks, HookExecutionConfig> = new Map();
  private eventListeners: Map<string, Set<(event: any) => void>> = new Map();
  private debugMode: boolean = false;

  constructor(options?: {
    debugMode?: boolean;
    defaultHookConfig?: Partial<HookExecutionConfig>;
  }) {
    this.debugMode = options?.debugMode ?? false;
    
    // デフォルトのフック実行設定
    const defaultConfig: HookExecutionConfig = {
      mode: 'sequential',
      timeout: 5000,
      retryCount: 0,
      continueOnError: true,
      ...options?.defaultHookConfig,
    };

    // 各フックタイプのデフォルト設定
    this.setHookConfig('onBeforeCellRender', { ...defaultConfig, mode: 'sequential' });
    this.setHookConfig('onAfterCellRender', { ...defaultConfig, mode: 'sequential' });
    this.setHookConfig('onRowClick', { ...defaultConfig, mode: 'first-match' });
    this.setHookConfig('onRowDoubleClick', { ...defaultConfig, mode: 'first-match' });
    this.setHookConfig('onKeyDown', { ...defaultConfig, mode: 'first-match' });
    this.setHookConfig('onBeforeNodeUpdate', { ...defaultConfig, mode: 'sequential' });
    this.setHookConfig('onAfterNodeUpdate', { ...defaultConfig, mode: 'parallel' });
  }

  /**
   * プラグインを登録する
   */
  register(plugin: TreeTablePlugin): void {
    try {
      this.validatePlugin(plugin);
      
      if (this.plugins.has(plugin.name)) {
        throw new PluginRegistrationError(
          plugin.name,
          'Plugin with this name is already registered'
        );
      }

      // 依存関係チェック
      this.validateDependencies(plugin);

      const runtimeInfo: PluginRuntimeInfo = {
        plugin,
        state: 'registered',
        priority: 'normal', // TODO: プラグインから優先度を取得
        registeredAt: Date.now(),
        executionCount: 0,
        errors: [],
      };

      this.plugins.set(plugin.name, runtimeInfo);
      
      // プラグインの初期化
      this.initializePlugin(plugin.name);
      
      this.debug(`Plugin registered: ${plugin.name} v${plugin.version}`);
      this.emit('plugin:registered', { plugin: plugin.name });
      
    } catch (error) {
      this.debug(`Failed to register plugin ${plugin.name}:`, error);
      throw error;
    }
  }

  /**
   * プラグインの登録を解除する
   */
  unregister(pluginName: string): void {
    const runtimeInfo = this.plugins.get(pluginName);
    if (!runtimeInfo) {
      this.debug(`Plugin not found for unregistration: ${pluginName}`);
      return;
    }

    try {
      // プラグインの破棄処理
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
   * プラグインを取得する
   */
  getPlugin(name: string): TreeTablePlugin | undefined {
    return this.plugins.get(name)?.plugin;
  }

  /**
   * 登録されている全プラグインを取得する
   */
  getPlugins(): TreeTablePlugin[] {
    return Array.from(this.plugins.values())
      .filter(info => info.state === 'initialized')
      .sort((a, b) => this.comparePriority(a.priority, b.priority))
      .map(info => info.plugin);
  }

  /**
   * プラグインが登録されているかチェック
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name) && 
           this.plugins.get(name)?.state === 'initialized';
  }

  /**
   * 指定されたフックを実行する
   */
  executeHook<T extends keyof TreeTableHooks>(
    hookName: T,
    ...args: Parameters<NonNullable<TreeTableHooks[T]>>
  ): any[] {
    const config = this.hookConfigs.get(hookName) || this.getDefaultHookConfig();
    const availablePlugins = this.getAvailablePluginsForHook(hookName);
    
    if (availablePlugins.length === 0) {
      return [];
    }

    this.debug(`Executing hook: ${hookName} with ${availablePlugins.length} plugins`);
    
    const startTime = performance.now();
    let results: any[] = [];

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
      this.debug(`Hook execution failed: ${hookName}`, error);
      if (!config.continueOnError) {
        throw error;
      }
    }

    const executionTime = performance.now() - startTime;
    this.debug(`Hook ${hookName} completed in ${executionTime.toFixed(2)}ms`);
    
    this.emit('hook:executed', {
      hookName,
      pluginCount: availablePlugins.length,
      executionTime,
      results,
    });

    return results;
  }

  /**
   * フック実行設定を変更する
   */
  setHookConfig(hookName: keyof TreeTableHooks, config: Partial<HookExecutionConfig>): void {
    const currentConfig = this.hookConfigs.get(hookName) || this.getDefaultHookConfig();
    this.hookConfigs.set(hookName, { ...currentConfig, ...config });
  }

  /**
   * プラグインの状態を取得する
   */
  getPluginState(pluginName: string): PluginLifecycleState | undefined {
    return this.plugins.get(pluginName)?.state;
  }

  /**
   * プラグインの統計情報を取得する
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
   * デバッグモードの設定
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * イベントリスナーを追加
   */
  on(event: string, listener: (event: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * イベントリスナーを削除
   */
  off(event: string, listener: (event: any) => void): void {
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
          `Missing dependency: ${dependency}`
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
        info.plugin.hooks[hookName]
      )
      .sort((a, b) => this.comparePriority(a.priority, b.priority));
  }

  private executeHookSequential(
    hookName: keyof TreeTableHooks,
    plugins: PluginRuntimeInfo[],
    args: any[],
    config: HookExecutionConfig
  ): any[] {
    const results: any[] = [];
    
    for (const pluginInfo of plugins) {
      try {
        const result = this.executePluginHook(pluginInfo, hookName, args);
        results.push(result);
        
        // 特定のフックでは結果を次のプラグインに引き継ぐ
        if (hookName === 'onBeforeCellRender' && result) {
          args[0] = result;
        } else if (hookName === 'onAfterCellRender' && result) {
          args[0] = result;
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

  private executeHookParallel(
    hookName: keyof TreeTableHooks,
    plugins: PluginRuntimeInfo[],
    args: any[],
    config: HookExecutionConfig
  ): any[] {
    const promises = plugins.map(pluginInfo => 
      Promise.resolve(this.executePluginHook(pluginInfo, hookName, args))
        .catch(error => {
          this.handlePluginError(pluginInfo, hookName, error);
          return config.continueOnError ? undefined : Promise.reject(error);
        })
    );

    // Note: この実装は同期的ですが、実際の並列実行が必要な場合は
    // Promise.allSettled を使用する必要があります
    return promises.map((_promise, index) => {
      const plugin = plugins[index];
      if (!plugin) return undefined;
      
      try {
        return this.executePluginHook(plugin, hookName, args);
      } catch (error) {
        this.handlePluginError(plugin, hookName, error as Error);
        return config.continueOnError ? undefined : (() => { throw error; })();
      }
    });
  }

  private executeHookFirstMatch(
    hookName: keyof TreeTableHooks,
    plugins: PluginRuntimeInfo[],
    args: any[],
    config: HookExecutionConfig
  ): any[] {
    for (const pluginInfo of plugins) {
      try {
        const result = this.executePluginHook(pluginInfo, hookName, args);
        if (result !== undefined && result !== false) {
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

  private executeHookAccumulate(
    hookName: keyof TreeTableHooks,
    plugins: PluginRuntimeInfo[],
    args: any[],
    config: HookExecutionConfig
  ): any[] {
    const results: any[] = [];
    
    for (const pluginInfo of plugins) {
      try {
        const result = this.executePluginHook(pluginInfo, hookName, args);
        if (result !== undefined) {
          if (Array.isArray(result)) {
            results.push(...result);
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

  private executePluginHook(
    pluginInfo: PluginRuntimeInfo,
    hookName: keyof TreeTableHooks,
    args: any[]
  ): any {
    const hook = pluginInfo.plugin.hooks[hookName];
    if (!hook) return undefined;

    try {
      pluginInfo.executionCount++;
      pluginInfo.lastExecuted = Date.now();
      
      const result = (hook as any)(...args);
      
      this.debug(`Hook ${hookName} executed successfully in plugin ${pluginInfo.plugin.name}`);
      return result;
      
    } catch (error) {
      throw new HookExecutionError(
        pluginInfo.plugin.name,
        hookName,
        error as Error
      );
    }
  }

  private handlePluginError(
    pluginInfo: PluginRuntimeInfo,
    hookName: keyof TreeTableHooks,
    error: Error
  ): void {
    pluginInfo.errors.push(error);
    
    // エラーが頻繁に発生する場合はプラグインを無効化
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

  private emit(event: string, data: any): void {
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

  private debug(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.debug(`[PluginRegistry] ${message}`, ...args);
    }
  }
}