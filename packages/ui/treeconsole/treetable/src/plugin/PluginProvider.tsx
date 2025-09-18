/**
  * Plugin Provider Component
  * TreeTableReact
   */

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { PluginRegistry } from './PluginRegistry.js';
import type {
  PluginContext as IPluginContext,
  PluginEvent,
  PluginRegistry as IPluginRegistry,
  TreeTablePlugin,
  TreeTablePluginConfig,
} from './types.js';

// =============================================================================
// Context Definition
// =============================================================================

export const PluginContext: React.Context<IPluginContext | null> = createContext<IPluginContext | null>(null);

// =============================================================================
// Provider Props
// =============================================================================

export interface PluginProviderProps {
  /**
      */
  children: ReactNode;
  /**
      */
  plugins?: TreeTablePlugin[];
  /**
      */
  config?: TreeTablePluginConfig;
  /**
      */
  debugMode?: boolean;
  /**
      */
  onPluginEvent?: (event: PluginEvent) => void;
}

// =============================================================================
// Provider Implementation
// =============================================================================

/**
    */
export function PluginProvider({
                                 children,
                                 plugins = [],
                                 config,
                                 debugMode = false,
                                 onPluginEvent,
                               }: PluginProviderProps): ReactElement {
  //  Plugin Registry
  const registry = useMemo(() => {
    return new PluginRegistry({
      debugMode,
      // config?.global has different properties than HookExecutionConfig
      defaultHookConfig: undefined,
    });
  }, [debugMode, config?.global]);

  const [events, setEvents] = useState<PluginEvent[]>([]);
  const [pluginStates, setPluginStates] = useState<Record<string, any>>({});

  useEffect(() => {
    const registerPlugins = async () => {
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

      const sortedPlugins = sortPluginsByDependencies(plugins);

      for (const plugin of sortedPlugins) {
        try {
          const pluginConfig = config?.plugins[plugin.name];
          if (pluginConfig && !pluginConfig.enabled) {
            continue;
          }

          registry.register(plugin);

        } catch (error) {
          console.error(`Failed to register plugin ${plugin.name}:`, error);

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

  useEffect(() => {
    const handlePluginEvent = (event: any) => {
      const pluginEvent: PluginEvent = {
        type: event.type || 'unknown',
        plugin: event.plugin || 'unknown',
        timestamp: Date.now(),
        data: event,
      };

      setEvents(prev => [...prev.slice(-99), pluginEvent]); //  100
      onPluginEvent?.(pluginEvent);
    };

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

  const executeHook = useCallback(<T extends keyof import('./types.js').TreeTableHooks>(
    hookName: T,
    ...args: Parameters<NonNullable<import('./types.js').TreeTableHooks[T]>>
  ) => {
    return registry.executeHook(hookName, ...args);
  }, [registry]);

  useEffect(() => {
    const updatePluginStates = () => {
      const states: Record<string, any> = {};
      for (const plugin of registry.getPlugins()) {
        states[plugin.name] = registry.getPluginStats(plugin.name);
      }
      setPluginStates(states);
    };

    updatePluginStates();

    let interval: ReturnType<typeof setInterval> | undefined;
    if (debugMode) {
      interval = setInterval(updatePluginStates, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [registry, debugMode]);

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
    */
export function usePluginContext(): IPluginContext {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePluginContext must be used within PluginProvider');
  }
  return context;
}

/**
    */
export function usePluginRegistry(): IPluginRegistry {
  const { registry } = usePluginContext();
  return registry;
}

/**
    */
export function usePlugin(pluginName: string): TreeTablePlugin | undefined {
  const registry = usePluginRegistry();
  return registry.getPlugin(pluginName);
}

/**
    */
export function usePluginHooks() {
  const { executeHook } = usePluginContext();
  return executeHook;
}

/**
    */
export function usePluginEnabled(pluginName: string): boolean {
  const registry = usePluginRegistry();
  return registry.hasPlugin(pluginName);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
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
  * HOC
  */
export function withPlugins<P extends object>(
  Component: React.ComponentType<P>,
  defaultPlugins: TreeTablePlugin[] = [],
) {
  return function PluginEnhancedComponent(
    props: P & { plugins?: TreeTablePlugin[] },
  ): ReactElement {
    const { plugins = defaultPlugins, ...restProps } = props;

    return (
      <PluginProvider plugins={plugins}>
        <Component {...(restProps as P)} />
      </PluginProvider>
    );
  };
}
