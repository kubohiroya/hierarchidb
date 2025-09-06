/**
 * Plugin Provider Component
 * 
 * TreeTableプラグインシステムのReactコンテキストプロバイダー。
 * プラグインレジストリを管理し、子コンポーネントにプラグイン機能を提供します。
 */

import { 
  createContext, 
  useContext, 
  useMemo, 
  useEffect, 
  useState,
  useCallback,
  ReactNode 
} from 'react';
import { PluginRegistry } from './PluginRegistry';
import type { 
  TreeTablePlugin, 
  PluginContext as IPluginContext,
  TreeTablePluginConfig,
  PluginEvent,
  PluginRegistry as IPluginRegistry
} from './types';

// =============================================================================
// Context Definition
// =============================================================================

export const PluginContext = createContext<IPluginContext | null>(null);

// =============================================================================
// Provider Props
// =============================================================================

export interface PluginProviderProps {
  /** 子コンポーネント */
  children: ReactNode;
  /** 登録するプラグインのリスト */
  plugins?: TreeTablePlugin[];
  /** プラグインの設定 */
  config?: TreeTablePluginConfig;
  /** デバッグモードを有効にする */
  debugMode?: boolean;
  /** プラグインイベントのリスナー */
  onPluginEvent?: (event: PluginEvent) => void;
}

// =============================================================================
// Provider Implementation
// =============================================================================

/**
 * プラグインシステムのコンテキストプロバイダー
 */
export function PluginProvider({ 
  children, 
  plugins = [],
  config,
  debugMode = false,
  onPluginEvent,
}: PluginProviderProps) {
  // Plugin Registry の初期化
  const registry = useMemo(() => {
    return new PluginRegistry({
      debugMode,
      // config?.global has different properties than HookExecutionConfig
      defaultHookConfig: undefined,
    });
  }, [debugMode, config?.global]);

  // プラグインのイベント追跡
  const [events, setEvents] = useState<PluginEvent[]>([]);
  const [pluginStates, setPluginStates] = useState<Record<string, any>>({});

  // プラグインの登録
  useEffect(() => {
    const registerPlugins = async () => {
      // 既存のプラグインをクリア（開発時のホットリロード対応）
      // Avoid direct `process` in browser builds; prefer Vite-style DEV flag when available.
      const isDev = (() => {
        try {
          return (
            (typeof globalThis !== 'undefined' &&
              (globalThis as { import?: { meta?: { env?: { DEV?: boolean } } } })?.import?.meta?.env?.DEV) || false
          );
        } catch {
          return false;
        }
      })();

      if (isDev) {
        for (const pluginName of registry.getPlugins().map(p => p.name)) {
          registry.unregister(pluginName);
        }
      }

      // プラグインの依存関係順に登録
      const sortedPlugins = sortPluginsByDependencies(plugins);
      
      for (const plugin of sortedPlugins) {
        try {
          // 設定チェック
          const pluginConfig = config?.plugins[plugin.name];
          if (pluginConfig && !pluginConfig.enabled) {
            continue; // 無効なプラグインはスキップ
          }

          registry.register(plugin);
          
        } catch (error) {
          console.error(`Failed to register plugin ${plugin.name}:`, error);
          
          // エラーをイベントとして発火
          const errorEvent: PluginEvent = {
            type: 'plugin:registration-error',
            plugin: plugin.name,
            timestamp: Date.now(),
            data: { error },
          };
          onPluginEvent?.(errorEvent);
        }
      }
    };

    registerPlugins();
  }, [plugins, config, registry, onPluginEvent]);

  // プラグインイベントのリスニング
  useEffect(() => {
    const handlePluginEvent = (event: any) => {
      const pluginEvent: PluginEvent = {
        type: event.type || 'unknown',
        plugin: event.plugin || 'unknown',
        timestamp: Date.now(),
        data: event,
      };

      setEvents(prev => [...prev.slice(-99), pluginEvent]); // 最新100件を保持
      onPluginEvent?.(pluginEvent);
    };

    // 各種プラグインイベントをリスニング
    registry.on('plugin:registered', handlePluginEvent);
    registry.on('plugin:unregistered', handlePluginEvent);
    registry.on('plugin:error', handlePluginEvent);
    registry.on('hook:executed', handlePluginEvent);

    return () => {
      registry.off('plugin:registered', handlePluginEvent);
      registry.off('plugin:unregistered', handlePluginEvent);
      registry.off('plugin:error', handlePluginEvent);
      registry.off('hook:executed', handlePluginEvent);
    };
  }, [registry, onPluginEvent]);

  // フック実行の便利メソッド
  const executeHook = useCallback(<T extends keyof import('./types').TreeTableHooks>(
    hookName: T,
    ...args: Parameters<NonNullable<import('./types').TreeTableHooks[T]>>
  ) => {
    return registry.executeHook(hookName, ...args);
  }, [registry]);

  // プラグイン状態の更新
  useEffect(() => {
    const updatePluginStates = () => {
      const states: Record<string, any> = {};
      for (const plugin of registry.getPlugins()) {
        states[plugin.name] = registry.getPluginStats(plugin.name);
      }
      setPluginStates(states);
    };

    // 初期状態を設定
    updatePluginStates();

    // 定期的に状態を更新（デバッグモードのみ）
    let interval: NodeJS.Timeout | undefined;
    if (debugMode) {
      interval = setInterval(updatePluginStates, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [registry, debugMode]);

  // コンテキスト値
  const contextValue = useMemo<IPluginContext>(() => ({
    registry,
    executeHook,
  }), [registry, executeHook]);

  return (
    <PluginContext.Provider value={contextValue}>
      {children}
      {debugMode && (
        <PluginDebugPanel 
          events={events}
          pluginStates={pluginStates}
        />
      )}
    </PluginContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * プラグインコンテキストを使用するフック
 */
export function usePluginContext(): IPluginContext {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePluginContext must be used within PluginProvider');
  }
  return context;
}

/**
 * プラグインレジストリを使用するフック
 */
export function usePluginRegistry(): IPluginRegistry {
  const { registry } = usePluginContext();
  return registry;
}

/**
 * 特定のプラグインを使用するフック
 */
export function usePlugin(pluginName: string): TreeTablePlugin | undefined {
  const registry = usePluginRegistry();
  return registry.getPlugin(pluginName);
}

/**
 * フック実行を行うフック
 */
export function usePluginHooks() {
  const { executeHook } = usePluginContext();
  return executeHook;
}

/**
 * プラグインの有効性をチェックするフック
 */
export function usePluginEnabled(pluginName: string): boolean {
  const registry = usePluginRegistry();
  return registry.hasPlugin(pluginName);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * プラグインを依存関係の順序でソートする
 */
function sortPluginsByDependencies(plugins: TreeTablePlugin[]): TreeTablePlugin[] {
  const sorted: TreeTablePlugin[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(plugin: TreeTablePlugin) {
    if (visiting.has(plugin.name)) {
      throw new Error(`Circular dependency detected involving plugin: ${plugin.name}`);
    }

    if (visited.has(plugin.name)) {
      return;
    }

    visiting.add(plugin.name);

    // 依存関係を先に処理
    if (plugin.dependencies) {
      for (const depName of plugin.dependencies) {
        const depPlugin = plugins.find(p => p.name === depName);
        if (depPlugin) {
          visit(depPlugin);
        }
      }
    }

    visiting.delete(plugin.name);
    visited.add(plugin.name);
    sorted.push(plugin);
  }

  for (const plugin of plugins) {
    visit(plugin);
  }

  return sorted;
}

// =============================================================================
// Debug Panel Component
// =============================================================================

interface PluginDebugPanelProps {
  events: PluginEvent[];
  pluginStates: Record<string, any>;
}

function PluginDebugPanel({ events, pluginStates }: PluginDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 9999,
          background: '#333',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(true)}
      >
        🔌 Plugins ({Object.keys(pluginStates).length})
      </div>
    );
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        width: 400,
        maxHeight: 500,
        zIndex: 9999,
        background: '#333',
        color: 'white',
        borderRadius: '4px',
        fontSize: '12px',
        overflow: 'auto',
      }}
    >
      <div 
        style={{
          padding: '10px',
          borderBottom: '1px solid #555',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <strong>Plugin Debug Panel</strong>
        <button 
          onClick={() => setIsExpanded(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '10px' }}>
        <h4>Registered Plugins ({Object.keys(pluginStates).length})</h4>
        {Object.entries(pluginStates).map(([name, state]) => (
          <div key={name} style={{ marginBottom: '5px', fontSize: '11px' }}>
            <strong>{name}</strong> v{state?.version}
            <div style={{ color: '#aaa' }}>
              State: {state?.state} | Executions: {state?.executionCount}
              {state?.errorCount > 0 && (
                <span style={{ color: '#ff6b6b' }}> | Errors: {state.errorCount}</span>
              )}
            </div>
          </div>
        ))}

        <h4>Recent Events ({events.length})</h4>
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {events.slice(-10).reverse().map((event, index) => (
            <div key={index} style={{ marginBottom: '3px', fontSize: '10px' }}>
              <span style={{ color: '#61dafb' }}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              {' '}
              <span style={{ color: '#ffd93d' }}>{event.type}</span>
              {' '}
              <span>{event.plugin}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Higher-Order Component
// =============================================================================

/**
 * プラグイン機能を追加するHOC
 */
export function withPlugins<P extends object>(
  Component: React.ComponentType<P>,
  defaultPlugins: TreeTablePlugin[] = []
) {
  return function PluginEnhancedComponent(
    props: P & { plugins?: TreeTablePlugin[] }
  ) {
    const { plugins = defaultPlugins, ...restProps } = props;
    
    return (
      <PluginProvider plugins={plugins}>
        <Component {...(restProps as P)} />
      </PluginProvider>
    );
  };
}
