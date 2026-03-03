import { useCallback, useEffect, useMemo, useState } from 'react';
import { PluginRegistry } from './PluginRegistry.js';
import type {
  PluginContext as IPluginContext,
  PluginEvent,
  PluginLifecycleState,
  PluginPriority,
  TreeTablePlugin,
  TreeTablePluginConfig,
} from './types.js';

export type PluginStats = {
  name: string;
  version: string;
  state: PluginLifecycleState;
  priority: PluginPriority;
  registeredAt: number;
  lastExecuted?: number;
  executionCount: number;
  errorCount: number;
  recentErrors: Error[];
};

interface UsePluginProviderStateParams {
  plugins: TreeTablePlugin[];
  config?: TreeTablePluginConfig;
  debugMode: boolean;
  onPluginEvent?: (event: PluginEvent) => void;
}

interface UsePluginProviderStateResult {
  events: Array<PluginEvent<unknown>>;
  pluginStates: Record<string, PluginStats | undefined>;
  contextValue: IPluginContext;
}

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
      for (const dependencyName of plugin.dependencies) {
        const dependencyPlugin = plugins.find((candidate) => candidate.name === dependencyName);
        if (dependencyPlugin) {
          visit(dependencyPlugin);
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

function isDevRuntime(): boolean {
  try {
    return (
      (typeof globalThis !== 'undefined' &&
        (globalThis as { import?: { meta?: { env?: { DEV?: boolean } } } })?.import?.meta?.env?.DEV) || false
    );
  } catch {
    return false;
  }
}

export function usePluginProviderState({
  plugins,
  config,
  debugMode,
  onPluginEvent,
}: UsePluginProviderStateParams): UsePluginProviderStateResult {
  const registry = useMemo(() => {
    return new PluginRegistry({
      debugMode,
      defaultHookConfig: undefined,
    });
  }, [debugMode]);

  const [events, setEvents] = useState<Array<PluginEvent<unknown>>>([]);
  const [pluginStates, setPluginStates] = useState<Record<string, PluginStats | undefined>>({});

  useEffect(() => {
    const registerPlugins = async () => {
      if (isDevRuntime()) {
        for (const pluginName of registry.getPlugins().map((plugin) => plugin.name)) {
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
    const handlePluginEvent = (event: unknown) => {
      const payload = (typeof event === 'object' && event !== null) ? (event as Record<string, unknown>) : undefined;
      const pluginEvent: PluginEvent<unknown> = {
        type: (payload?.type as string | undefined) ?? 'unknown',
        plugin: (payload?.plugin as string | undefined) ?? 'unknown',
        timestamp: Date.now(),
        data: event,
      };

      setEvents((prev) => [...prev.slice(-99), pluginEvent]);
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

  const executeHook = useCallback(
    <T extends keyof import('./types.js').TreeTableHooks>(
      hookName: T,
      ...args: Parameters<NonNullable<import('./types.js').TreeTableHooks[T]>>
    ) => {
      return registry.executeHook(hookName, ...args);
    },
    [registry],
  );

  useEffect(() => {
    const updatePluginStates = () => {
      const states: Record<string, PluginStats | undefined> = {};
      for (const plugin of registry.getPlugins()) {
        states[plugin.name] = registry.getPluginStats(plugin.name) as PluginStats | undefined;
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

  const contextValue = useMemo<IPluginContext>(
    () => ({
      registry,
      executeHook,
    }),
    [registry, executeHook],
  );

  return {
    events,
    pluginStates,
    contextValue,
  };
}

export function usePluginDebugPanelState(): {
  isExpanded: boolean;
  openPanel: () => void;
  closePanel: () => void;
} {
  const [isExpanded, setIsExpanded] = useState(false);

  const openPanel = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsExpanded(false);
  }, []);

  return {
    isExpanded,
    openPanel,
    closePanel,
  };
}
