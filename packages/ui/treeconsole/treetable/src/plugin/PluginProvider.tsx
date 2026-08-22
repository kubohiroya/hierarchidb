/**
 * Plugin Provider Component
 * TreeTableReact
 */

import { createContext, type ReactElement, type ReactNode, useContext } from 'react';
import type {
  PluginContext as IPluginContext,
  PluginRegistry as IPluginRegistry,
  PluginEvent,
  TreeTablePlugin,
  TreeTablePluginConfig,
} from './types.js';
import {
  type PluginStats,
  usePluginDebugPanelState,
  usePluginProviderState,
} from './usePluginProviderState.js';

// =============================================================================
// Context Definition
// =============================================================================

export const PluginContext: React.Context<IPluginContext | null> =
  createContext<IPluginContext | null>(null);

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
  const { events, pluginStates, contextValue } = usePluginProviderState({
    plugins,
    config,
    debugMode,
    onPluginEvent,
  });

  return (
    <PluginContext.Provider value={contextValue}>
      {children}
      {debugMode && <PluginDebugPanel events={events} pluginStates={pluginStates} />}
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
// Debug Panel Component
// =============================================================================

interface PluginDebugPanelProps {
  events: Array<PluginEvent<unknown>>;
  pluginStates: Record<string, PluginStats | undefined>;
}

function PluginDebugPanel({ events, pluginStates }: PluginDebugPanelProps) {
  const { isExpanded, openPanel, closePanel } = usePluginDebugPanelState();

  if (!isExpanded) {
    return (
      <button
        type="button"
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
          border: 'none',
        }}
        onClick={openPanel}
      >
        🔌 Plugins ({Object.keys(pluginStates).length})
      </button>
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
          type="button"
          onClick={closePanel}
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
              {state?.errorCount && state.errorCount > 0 ? (
                <span style={{ color: '#ff6b6b' }}> | Errors: {state.errorCount}</span>
              ) : null}
            </div>
          </div>
        ))}

        <h4>Recent Events ({events.length})</h4>
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {events
            .slice(-10)
            .reverse()
            .map((event) => (
              <div
                key={`${event.timestamp}-${event.type}-${event.plugin}`}
                style={{ marginBottom: '3px', fontSize: '10px' }}
              >
                <span style={{ color: '#61dafb' }}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>{' '}
                <span style={{ color: '#ffd93d' }}>{event.type}</span> <span>{event.plugin}</span>
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
  defaultPlugins: TreeTablePlugin[] = []
) {
  return function PluginEnhancedComponent(
    props: P & { plugins?: TreeTablePlugin[] }
  ): ReactElement {
    const { plugins = defaultPlugins, ...restProps } = props;

    return (
      <PluginProvider plugins={plugins}>
        <Component {...(restProps as P)} />
      </PluginProvider>
    );
  };
}
